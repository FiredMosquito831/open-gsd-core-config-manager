/**
 * Frozen REST API envelope types (02-CONTEXT.md § Claude's Discretion — REST
 * route shape; 02-API-CONTRACT.md is the human-readable mirror of this
 * file). Every `/api` response is exactly one of these two shapes.
 *
 * FROZEN: Phase 3's UI and Phase 5's version-history UI build directly
 * against `ApiOk`/`ApiErr`/`TrackedConfig`. Do not rename or restructure
 * these without treating it as a breaking-change/architectural decision
 * (deviation Rule 4).
 */

/** Success envelope: `{ ok: true }` merged with the route's own payload shape. */
export type ApiOk<T = Record<string, never>> = { ok: true } & T;

/** Error envelope: every non-2xx `/api` response uses this exact shape. */
export interface ApiErr {
  ok: false;
  errors: Array<{ message: string; [k: string]: unknown }>;
}

/**
 * A config file the server has accepted into its in-memory registry.
 * `id` is server-minted (never client-supplied) and `path` is the
 * server-resolved absolute filesystem path — see registry.ts's module doc
 * for why returning `path` here is safe (it is never accepted back from a
 * client as input, only ever returned as already-validated output).
 */
export interface TrackedConfig {
  /** Server-minted opaque id — the only identifier a client may use to address this config. */
  id: string;
  /** Server-resolved absolute filesystem path. */
  path: string;
  /** Display label for the Phase 3 sidebar — parent directory name plus filename. */
  name: string;
}

/**
 * A persisted workspace entry (03-02-PLAN.md). Adds a derived status to the
 * frozen TrackedConfig so missing or invalid files can be surfaced in the
 * sidebar without being silently discarded (D-14).
 */
export interface TrackedWorkspaceConfig extends TrackedConfig {
  /** Derived state: file is present and valid, missing, or no longer passes validation. */
  status: 'ok' | 'missing' | 'invalid';
  /** Human-readable problem description when status is not 'ok'. */
  problem?: string;
}

/** Safe, recorded facts about one historical config snapshot. */
export interface HistorySnapshotMeta {
  seq: number;
  timestamp: string;
  contentHash: string;
}

/** Selected historical document and the current persisted project document. */
export interface HistorySnapshotDetail {
  snapshot: HistorySnapshotMeta & { document: object };
  current: object;
  currentRevision?: string;
}

/** Normal save-pipeline result returned after a successful restore. */
export interface HistoryRestoreResult {
  snapshotId?: string;
  warning?: string;
}

/** Client-safe lifecycle state for the authoritative active schema generation. */
export interface SchemaStatusDto {
  source: 'bundled' | 'refreshed';
  gsdCoreVersion: string;
  generatedAt?: string;
  activatedAt?: string;
  warning?: string;
  lastChecked?: string;
  commitPrefix?: string;
  archiveSha256Prefix?: string;
}

/** One normalized semantic change retained for proposal review. */
export interface SchemaChangeDto {
  path: string;
  kind: string;
  before?: unknown;
  after?: unknown;
}

/** Review-safe, server-held proposal evidence. Schema content is intentionally absent. */
export interface SchemaProposalDto {
  id: string;
  expiresAt: string;
  checkedAt: string;
  gsdCoreVersion: string;
  changes: readonly SchemaChangeDto[];
  documentationDiagnostics: readonly unknown[];
}

/** One channel's key-detection state for a search provider. */
export interface KeyChannelStatusDto {
  configured: boolean;
}

/** File-channel key state, including the resolved absolute key-file path. */
export interface KeyFileChannelStatusDto extends KeyChannelStatusDto {
  path: string;
}

/** Detection state for one search capability across both of its key channels. */
export interface KeyStatusDto {
  /** Config key, e.g. "brave_search". */
  provider: string;
  /** Human-readable name, e.g. "Brave Search". */
  title: string;
  /** Environment variable name, e.g. "BRAVE_API_KEY". */
  envVar: string;
  /** Key filename (no directory), e.g. "brave_api_key". */
  fileSlug: string;
  /** Where the user obtains this key, if known. */
  homepage?: string;
  /** True when a key is present via EITHER channel. */
  configured: boolean;
  channels: { envVar: KeyChannelStatusDto; file: KeyFileChannelStatusDto };
}

/** Request body for writing/clearing a single provider key. */
export interface KeyWriteDto {
  provider: string;
  /** Secret value. Empty string clears the key. */
  value: string;
  /** Which channel(s) to write. */
  channel: 'file' | 'env' | 'both';
}

export type SchemaRefreshResponse = ApiOk<{ status: SchemaStatusDto; proposal?: SchemaProposalDto; noChange?: true }>
  | ApiErr;
export type SchemaActivationResponse = ApiOk<{ status: SchemaStatusDto }> | ApiErr;
export type SchemaCancellationResponse = ApiOk<{ cancelled: true }> | ApiErr;
export type SchemaResetResponse = ApiOk<{ status: SchemaStatusDto }> | ApiErr;
