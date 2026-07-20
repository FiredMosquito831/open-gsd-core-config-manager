import { buildAjvSchema, createValidator } from '../../config-io/src/index.js';
import type { SchemaEntry, ValidationResult } from '../../config-io/src/types.js';
import type { CanonicalSchemaMetadata } from '../../schema-data/src/source-types.js';
import { getBundledSchema, getBundledSchemaMetadata } from './schema.js';
import { SchemaOverrideStore, type PersistedSchemaOverride } from './schema-persistence.js';

const FALLBACK_WARNING = 'Saved schema override was ignored; the bundled schema is active.';

export interface SchemaStatus {
  source: 'bundled' | 'refreshed';
  gsdCoreVersion: string;
  /** Build-time generation date for the immutable bundled baseline. */
  generatedAt?: string;
  activatedAt?: string;
  warning?: string;
}

export interface ActiveSchemaSnapshot {
  readonly schema: Readonly<Record<string, SchemaEntry>>;
  readonly validator: (data: unknown) => ValidationResult;
  readonly metadata: Readonly<CanonicalSchemaMetadata>;
  readonly status: Readonly<SchemaStatus>;
}

export interface SchemaProposal {
  schema: Record<string, SchemaEntry>;
  metadata: CanonicalSchemaMetadata;
}

export interface ActiveSchemaManagerOptions {
  appDataRoot?: string;
  store?: SchemaOverrideStore;
  now?: () => Date;
  warn?: (message: string, error?: unknown) => void;
}

function stableVersion(value: string): [number, number, number] | undefined {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

function compareStableVersions(left: string, right: string): number | undefined {
  const a = stableVersion(left);
  const b = stableVersion(right);
  if (!a || !b) return undefined;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function validIdentity(metadata: CanonicalSchemaMetadata): boolean {
  if (metadata.envelopeVersion !== 1 || (metadata.source !== 'bundled' && metadata.source !== 'refreshed')) return false;
  if (!stableVersion(metadata.gsdCoreVersion) || metadata.tag !== `v${metadata.gsdCoreVersion}`) return false;
  if (metadata.commit !== undefined && !/^[a-f0-9]{40}$/i.test(metadata.commit)) return false;
  if (metadata.archiveSha256 !== undefined && !/^[a-f0-9]{64}$/i.test(metadata.archiveSha256)) return false;
  return true;
}

function immutableIdentityEqual(left: CanonicalSchemaMetadata, right: CanonicalSchemaMetadata): boolean {
  return left.commit === right.commit && left.archiveSha256 === right.archiveSha256;
}

function compileSnapshot(schema: Record<string, SchemaEntry>, metadata: CanonicalSchemaMetadata, status: SchemaStatus): ActiveSchemaSnapshot {
  if (!validIdentity(metadata) || !schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('Invalid schema override');
  }
  const validator = createValidator(buildAjvSchema(schema));
  return Object.freeze({
    schema: Object.freeze(schema),
    validator,
    metadata: Object.freeze({ ...metadata }),
    status: Object.freeze({ ...status }),
  });
}

function bundledSnapshot(warning?: string): ActiveSchemaSnapshot {
  const metadata = getBundledSchemaMetadata();
  return compileSnapshot(getBundledSchema(), metadata, {
    source: 'bundled',
    gsdCoreVersion: metadata.gsdCoreVersion,
    generatedAt: metadata.generatedAt,
    ...(warning ? { warning } : {}),
  });
}

function isPersistedOverride(value: unknown): value is PersistedSchemaOverride {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.envelopeVersion === 1 && typeof record.activatedAt === 'string' && !!record.schema && !!record.metadata;
}

export class ActiveSchemaManager {
  private active: ActiveSchemaSnapshot;
  private generation = 0;
  private constructor(
    initial: ActiveSchemaSnapshot,
    private readonly store: SchemaOverrideStore,
    private readonly now: () => Date,
  ) {
    this.active = initial;
  }

  static async create(options: ActiveSchemaManagerOptions = {}): Promise<ActiveSchemaManager> {
    const store = options.store ?? new SchemaOverrideStore({ appDataRoot: options.appDataRoot });
    const baseline = bundledSnapshot();
    let initial = baseline;
    try {
      const persisted = store.read();
      if (persisted !== undefined) {
        if (!isPersistedOverride(persisted)) throw new Error('Invalid envelope');
        const candidate = compileSnapshot(persisted.schema, persisted.metadata, {
          source: 'refreshed',
          gsdCoreVersion: persisted.metadata.gsdCoreVersion,
          activatedAt: persisted.activatedAt,
        });
        const precedence = compareStableVersions(candidate.metadata.gsdCoreVersion, baseline.metadata.gsdCoreVersion);
        if (precedence === undefined || (precedence === 0 && !immutableIdentityEqual(candidate.metadata, baseline.metadata))) {
          throw new Error('Conflicting or invalid schema identity');
        }
        if (precedence > 0) initial = candidate;
      }
    } catch (error) {
      options.warn?.(FALLBACK_WARNING, error);
      initial = bundledSnapshot(FALLBACK_WARNING);
    }
    return new ActiveSchemaManager(initial, store, options.now ?? (() => new Date()));
  }

  snapshot(): ActiveSchemaSnapshot {
    return this.active;
  }

  currentGeneration(): number {
    return this.generation;
  }

  async activateValidatedProposal(proposal: SchemaProposal): Promise<SchemaStatus> {
    const activatedAt = this.now().toISOString();
    const snapshot = compileSnapshot(proposal.schema, { ...proposal.metadata, source: 'refreshed' }, {
      source: 'refreshed',
      gsdCoreVersion: proposal.metadata.gsdCoreVersion,
      activatedAt,
    });
    const envelope: PersistedSchemaOverride = {
      envelopeVersion: 1,
      schema: proposal.schema,
      metadata: { ...proposal.metadata, source: 'refreshed' },
      activatedAt,
    };
    await this.store.write(envelope);
    this.active = snapshot;
    this.generation += 1;
    return snapshot.status;
  }

  async resetToBundled(): Promise<SchemaStatus> {
    const snapshot = bundledSnapshot();
    await this.store.remove();
    this.active = snapshot;
    this.generation += 1;
    return snapshot.status;
  }
}
