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
