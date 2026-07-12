/**
 * Public config-io API barrel — the single import surface Phase 2's
 * loopback server and Phase 3's schema-driven UI build against.
 *
 * Frozen: adding/renaming an export here after this plan lands is an
 * expensive downstream change (01-CONTEXT.md § Integration Points). Keep
 * this file import-only — no logic lives here.
 *
 * Internal-only helpers (e.g. `getAtPath`) are intentionally NOT re-exported
 * unless a downstream phase needs them.
 */

// Read side (DISC-06, SAVE-03).
export { load } from './load.js';
export type { LoadOptions } from './load.js';

// Write side (SAVE-01, SAVE-02).
export { saveConfig, writeWithRetry, ValidationError } from './atomic-write.js';

// Validation (SAVE-01) + the flat-schema -> Ajv-schema bridge (see
// schema-convert.ts's module doc for why this is needed alongside
// createValidator: bundled-schema.json is a flat dot-path map, not itself
// an Ajv-compilable document).
export { createValidator, formatErrors } from './validate.js';
export { buildAjvSchema } from './schema-convert.js';

// Prototype-pollution-safe patch-in-place primitive (SAVE-03 patch-in-place
// invariant).
export { safeSet } from './patch.js';

// Global-defaults discovery (DISC-06).
export { resolveGlobalDefaultsPath, readGlobalDefaults } from './discovery.js';

// Layered effective-value merge (SAVE-03 provenance).
export { resolveLeaf, buildEffectiveTree } from './merge.js';
export type { MergeLayers } from './merge.js';

// Frozen Phase 1 data contracts.
export type {
  Provenance,
  EffectiveLeaf,
  EffectiveNode,
  UnknownKeyEntry,
  LoadResult,
  ValidationResult,
  SchemaEntry,
} from './types.js';
