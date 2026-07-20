export interface SourceIdentity {
  gsdCoreVersion: string;
  tag: string;
  commit?: string;
  archiveSha256?: string;
  generatedAt?: string;
}

export interface CanonicalSchemaMetadata extends SourceIdentity {
  envelopeVersion: 1;
  source: 'bundled' | 'refreshed';
}

export interface DynamicKeyPattern {
  topLevel: string;
  source: string;
  description: string;
}

export interface SchemaManifestSource {
  validKeys: string[];
  runtimeStateKeys: string[];
  dynamicKeyPatterns: DynamicKeyPattern[];
}

export interface CapabilitySchemaSourceEntry {
  owner?: string;
  type: 'boolean' | 'number' | 'string' | 'enum';
  default?: unknown;
  description?: string;
  values?: string[];
}

/** Parsed inert source data. No source capability or file path belongs here. */
export interface ParsedSchemaSources {
  manifest: SchemaManifestSource;
  defaults: Record<string, unknown>;
  capabilitySchema: Record<string, CapabilitySchemaSourceEntry>;
  fixtureValues: Record<string, unknown>[];
  upstreamDocumentationFingerprints: Record<string, string>;
}

export interface CanonicalSchemaEntry {
  type: string | string[];
  enum?: unknown[];
  default?: unknown;
  title: string;
  'x-category': string;
  'x-description': string;
  'x-provenance': string;
  patternProperties?: Record<string, CanonicalSchemaEntry>;
  'x-dynamic-key-hint'?: string;
  'x-options'?: Record<string, { 'x-description': string }>;
  'x-specialized'?: Record<string, unknown>;
  'x-deprecated'?: boolean;
  'x-deprecated-since'?: string;
  'x-deprecation-source'?: Pick<SourceIdentity, 'gsdCoreVersion' | 'tag' | 'commit'>;
}

export type CanonicalSchema = Record<string, CanonicalSchemaEntry>;

export type SchemaChangeGroup = 'added' | 'changed' | 'deprecated' | 'documentation-drift';

export interface SchemaChange {
  key: string;
  group: SchemaChangeGroup;
  summary: string;
  previous: Record<string, unknown> | null;
  proposed: Record<string, unknown> | null;
}

export interface SchemaChangeSet {
  changes: SchemaChange[];
  byGroup: Record<SchemaChangeGroup, SchemaChange[]>;
}

export interface ReconciliationOverlays {
  curated: Record<string, Partial<CanonicalSchemaEntry>>;
  specialized: Record<string, Record<string, unknown>>;
}

export interface ReconciliationResult {
  schema: CanonicalSchema;
  metadata: CanonicalSchemaMetadata;
}
