/**
 * Bundle-safe inlined schema access (T-02-26; see the plan's
 * `<bundled_schema_landmine>` note).
 *
 * `packages/config-io/src/load.ts` resolves its DEFAULT schema path via
 * `import.meta.url` relative to its own module location. That works under
 * `tsx`/source execution, but breaks once Plan 07 bundles everything into a
 * single `dist/cli.js`: `import.meta.url` then points inside the bundle, and
 * the relative `../../schema-data/bundled-schema.json` walk no longer
 * resolves to a real path inside the published tarball — every `npx` user
 * would fail at first load.
 *
 * The fix: this module NEVER lets the server rely on that default
 * resolution. It imports the bundled schema as a JSON MODULE (`with { type:
 * 'json' }`), which esbuild/tsup inlines directly into the bundle at build
 * time — no runtime file resolution at all. Every route passes the result
 * of `getBundledSchema()` explicitly into `load(path, { schema })` and into
 * `createValidator(buildAjvSchema(schema))`.
 *
 * Do NOT "fix" the landmine by editing `packages/config-io/src/load.ts` —
 * it is frozen and its default-path behavior is correct for its own
 * callers; `LoadOptions.schema` already exists as the intended injection
 * seam this module uses.
 */
import bundledSchema from '../../schema-data/bundled-schema.json' with { type: 'json' };
import bundledSchemaMetadata from '../../schema-data/bundled-schema-meta.json' with { type: 'json' };
import { buildAjvSchema, createValidator } from '../../config-io/src/index.js';
import type { SchemaEntry, ValidationResult } from '../../config-io/src/types.js';
import type { CanonicalSchemaMetadata } from '../../schema-data/src/source-types.js';

const SCHEMA = bundledSchema as unknown as Record<string, SchemaEntry>;
const METADATA = bundledSchemaMetadata as CanonicalSchemaMetadata;

/** Returns the immutable bundled canonical schema inlined at build time. */
export function getBundledSchema(): Record<string, SchemaEntry> {
  return SCHEMA;
}

/** Returns immutable shipped provenance without any runtime source-tree reads. */
export function getBundledSchemaMetadata(): CanonicalSchemaMetadata {
  return METADATA;
}

/**
 * Compatibility-only bundled validator. Runtime consumers move to
 * ActiveSchemaManager snapshots so renderer and validation share one generation.
 */
let cachedValidator: ((data: unknown) => ValidationResult) | undefined;
export function getValidator(): (data: unknown) => ValidationResult {
  if (!cachedValidator) cachedValidator = createValidator(buildAjvSchema(SCHEMA));
  return cachedValidator;
}
