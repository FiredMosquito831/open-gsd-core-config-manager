import { createHash } from 'node:crypto';
import { buildAjvSchema, createValidator } from '../../config-io/src/index.js';
import type { SchemaEntry } from '../../config-io/src/types.js';
import { diffCanonicalSchemas, reconcileSchemaSources } from '../../schema-data/src/reconcile.js';
import type {
  CanonicalSchema,
  CanonicalSchemaMetadata,
  ParsedSchemaSources,
  ReconciliationOverlays,
  SchemaChangeSet,
  SchemaManifestSource,
} from '../../schema-data/src/source-types.js';
import { parseCapabilityRegistryLiteral, type CapabilityParserLimits } from './capability-registry-parser.js';
import { extractDocumentationEvidence, type DocumentationEvidence, type DocumentationEvidenceLimits } from './documentation-evidence-parser.js';
import { inspectPinnedArchive, type ArchiveLimits, type InspectedArchive } from './upstream-archive.js';

const API_ROOT = 'https://api.github.com/repos/open-gsd/gsd-core';
const COMMIT = /^[a-f0-9]{40}$/iu;
const STABLE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const REQUIRED_PATHS = {
  manifest: 'gsd-core/bin/shared/config-schema.manifest.json',
  defaults: 'gsd-core/bin/shared/config-defaults.manifest.json',
  registry: 'gsd-core/bin/lib/capability-registry.cjs',
  documentation: 'docs/CONFIGURATION.md',
} as const;

const archiveLimits: ArchiveLimits = {
  maxCompressedBytes: 8 * 1024 * 1024, maxDecompressedBytes: 32 * 1024 * 1024,
  maxRequiredFileBytes: 1024 * 1024, maxRetainedBytes: 4 * 1024 * 1024,
  maxEntries: 4096, maxDepth: 12, maxHeaderBytes: 8192, maxMetadataRecords: 8,
  metadataTimeoutMs: 15_000, archiveTimeoutMs: 30_000,
};
const parserLimits: CapabilityParserLimits = { maxSourceBytes: 1024 * 1024, maxNodes: 20_000, maxDepth: 24 };
const documentationLimits: DocumentationEvidenceLimits = { maxSourceBytes: 1024 * 1024, maxHeadings: 4096, maxSectionBytes: 128 * 1024 };

export type RefreshStage = 'idle' | 'checking' | 'fetching' | 'validating' | 'preparing' | 'proposal' | 'no-change' | 'failure';
export type RefreshResult =
  | { kind: 'proposal'; proposal: SchemaProposal }
  | { kind: 'no-change'; checkedAt: string; gsdCoreVersion: string }
  | { kind: 'failure'; error: 'Unable to verify the latest stable schema release.' | 'Unable to prepare a schema refresh proposal.' };

export interface SchemaProposal {
  id: string;
  expiresAt: string;
  schema: CanonicalSchema;
  metadata: CanonicalSchemaMetadata;
  changes: SchemaChangeSet;
  documentationDiagnostics: DocumentationEvidence['diagnostics'];
  checkedAt: string;
}

export interface RefreshDependencies {
  fetchJson: (path: string) => Promise<unknown>;
  fetchBytes: (path: string) => Promise<Uint8Array>;
  inspectArchive: (archive: Uint8Array, limits: ArchiveLimits) => InspectedArchive;
  parseRegistry: (source: string, limits: CapabilityParserLimits) => ParsedSchemaSources['capabilitySchema'];
  documentation: (source: string, keys: readonly string[], limits: DocumentationEvidenceLimits) => DocumentationEvidence;
  reconcile: (sources: ParsedSchemaSources, active: CanonicalSchema, overlays: ReconciliationOverlays, identity: CanonicalSchemaMetadata) => { schema: CanonicalSchema; metadata: CanonicalSchemaMetadata };
  diff: (previous: CanonicalSchema, proposed: CanonicalSchema, fingerprints: { previous: Record<string, string>; proposed: Record<string, string> }) => SchemaChangeSet;
  compile: (schema: CanonicalSchema) => unknown;
  activeSchema: () => CanonicalSchema;
  activeMetadata: () => CanonicalSchemaMetadata;
  overlays: () => ReconciliationOverlays;
  now: () => Date;
  randomId: () => string;
  /** Test-only sentinel. Production refresh never calls activation. */
  activate?: () => void;
}

function fail(): never { throw new Error('refresh failed'); }
function text(value: Uint8Array | undefined): string { if (!value) fail(); return new TextDecoder().decode(value); }
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function stableVersion(tag: string): string { const match = STABLE_TAG.exec(tag); if (!match) fail(); return `${match[1]}.${match[2]}.${match[3]}`; }
function commitOf(value: unknown): string { const sha = record(value).sha; if (typeof sha !== 'string' || !COMMIT.test(sha)) fail(); return sha.toLowerCase(); }

function parseManifest(value: unknown): SchemaManifestSource {
  const source = record(value);
  if (!Array.isArray(source.validKeys) || !Array.isArray(source.runtimeStateKeys) || !Array.isArray(source.dynamicKeyPatterns)) fail();
  if (!source.validKeys.every((key) => typeof key === 'string') || !source.runtimeStateKeys.every((key) => typeof key === 'string')) fail();
  const patterns = source.dynamicKeyPatterns.map((entry) => {
    const item = record(entry);
    if (typeof item.topLevel !== 'string' || typeof item.source !== 'string' || typeof item.description !== 'string') fail();
    return { topLevel: item.topLevel, source: item.source, description: item.description };
  });
  return { validKeys: [...source.validKeys] as string[], runtimeStateKeys: [...source.runtimeStateKeys] as string[], dynamicKeyPatterns: patterns };
}

function defaults(value: unknown): Record<string, unknown> { return record(value); }

export class SchemaRefreshService {
  private currentStage: RefreshStage = 'idle';
  private retained: SchemaProposal | undefined;
  private checked: string | undefined;
  private inFlight: Promise<RefreshResult> | undefined;

  constructor(private readonly deps: RefreshDependencies) {}

  stage(): RefreshStage { return this.currentStage; }
  lastChecked(): string | undefined { return this.checked; }
  proposal(): SchemaProposal | undefined {
    if (this.retained && Date.parse(this.retained.expiresAt) <= this.deps.now().getTime()) this.retained = undefined;
    return this.retained;
  }
  cancelProposal(id: string): boolean {
    const proposal = this.proposal();
    if (!proposal || proposal.id !== id) return false;
    this.retained = undefined;
    this.currentStage = 'idle';
    return true;
  }

  refresh(): Promise<RefreshResult> {
    if (!this.inFlight) this.inFlight = this.run().finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }

  private async resolveCommit(tag: string): Promise<string> {
    let object = record(await this.deps.fetchJson(`${API_ROOT}/git/ref/tags/${tag}`)).object;
    for (let depth = 0; depth < 2; depth += 1) {
      const item = record(object);
      if (item.type === 'commit') return commitOf(item);
      if (item.type !== 'tag') fail();
      object = record(await this.deps.fetchJson(`${API_ROOT}/git/tags/${commitOf(item)}`)).object;
    }
    fail();
  }

  private async run(): Promise<RefreshResult> {
    this.retained = undefined; // a new attempt supersedes and releases any prior proposal.
    try {
      this.currentStage = 'checking';
      const release = record(await this.deps.fetchJson(`${API_ROOT}/releases/latest`));
      if (release.draft !== false || release.prerelease !== false || typeof release.tag_name !== 'string') fail();
      const tag = release.tag_name;
      const version = stableVersion(tag);
      const commit = await this.resolveCommit(tag);
      const active = this.deps.activeMetadata();
      if (active.gsdCoreVersion === version && active.commit !== undefined && active.commit !== commit) fail();

      this.currentStage = 'fetching';
      const archive = await this.deps.fetchBytes(`${API_ROOT}/tarball/${commit}`);
      const archiveSha256 = createHash('sha256').update(archive).digest('hex');
      const inspected = this.deps.inspectArchive(archive, archiveLimits);
      const manifest = parseManifest(JSON.parse(text(inspected.files[REQUIRED_PATHS.manifest])));
      const sourceDefaults = defaults(JSON.parse(text(inspected.files[REQUIRED_PATHS.defaults])));

      this.currentStage = 'validating';
      const capabilitySchema = this.deps.parseRegistry(text(inspected.files[REQUIRED_PATHS.registry]), parserLimits);
      const docs = this.deps.documentation(text(inspected.files[REQUIRED_PATHS.documentation]), manifest.validKeys, documentationLimits);
      const identity: CanonicalSchemaMetadata = { envelopeVersion: 1, source: 'refreshed', gsdCoreVersion: version, tag, commit, archiveSha256, generatedAt: this.deps.now().toISOString() };
      const sources: ParsedSchemaSources = { manifest, defaults: sourceDefaults, capabilitySchema, fixtureValues: [], upstreamDocumentationFingerprints: docs.fingerprints };

      this.currentStage = 'preparing';
      const activeSchema = this.deps.activeSchema();
      const candidate = this.deps.reconcile(sources, activeSchema, this.deps.overlays(), identity);
      this.deps.compile(candidate.schema);
      const changes = this.deps.diff(activeSchema, candidate.schema, { previous: Object.create(null), proposed: docs.fingerprints });
      const checkedAt = this.deps.now().toISOString();
      if (changes.changes.length === 0) {
        this.checked = checkedAt;
        this.currentStage = 'no-change';
        return { kind: 'no-change', checkedAt, gsdCoreVersion: version };
      }
      const expiresAt = new Date(this.deps.now().getTime() + 5 * 60_000).toISOString();
      const proposal: SchemaProposal = { id: this.deps.randomId(), expiresAt, schema: candidate.schema, metadata: candidate.metadata, changes, documentationDiagnostics: docs.diagnostics, checkedAt };
      this.retained = proposal;
      this.checked = checkedAt;
      this.currentStage = 'proposal';
      return { kind: 'proposal', proposal };
    } catch {
      this.retained = undefined;
      const error = this.currentStage === 'checking' || this.currentStage === 'idle'
        ? 'Unable to verify the latest stable schema release.'
        : 'Unable to prepare a schema refresh proposal.';
      this.currentStage = 'failure';
      return { kind: 'failure', error };
    }
  }
}

export function defaultRefreshDependencies(): RefreshDependencies {
  return {
    fetchJson: async (path) => {
      const response = await fetch(path, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) fail();
      return response.json();
    },
    fetchBytes: async (path) => {
      const response = await fetch(path, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) fail();
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > archiveLimits.maxCompressedBytes) fail();
      return bytes;
    },
    inspectArchive: inspectPinnedArchive,
    parseRegistry: (source, limits) => parseCapabilityRegistryLiteral(source, limits) as unknown as ParsedSchemaSources['capabilitySchema'],
    documentation: extractDocumentationEvidence,
    reconcile: reconcileSchemaSources,
    diff: diffCanonicalSchemas,
    compile: (schema) => createValidator(buildAjvSchema(schema as Record<string, SchemaEntry>)),
    activeSchema: () => { throw new Error('Active schema manager is required'); },
    activeMetadata: () => { throw new Error('Active schema manager is required'); },
    overlays: () => ({ curated: Object.create(null), specialized: Object.create(null) }),
    now: () => new Date(),
    randomId: () => crypto.randomUUID(),
  };
}
