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
import { buildAjvSchema, createValidator } from '../../config-io/src/index.js';
import type { SchemaEntry, ValidationResult } from '../../config-io/src/types.js';

const SCHEMA = bundledSchema as unknown as Record<string, SchemaEntry>;

/** Returns the bundled canonical schema (inlined at build time — never read from disk at runtime). */
export function getBundledSchema(): Record<string, SchemaEntry> {
  return SCHEMA;
}

let cachedValidator: ((data: unknown) => ValidationResult) | undefined;

/**
 * Returns the compiled Ajv validator for the bundled schema, memoized at
 * module scope — Ajv compilation is expensive and the schema never changes
 * at runtime.
 */
export function getValidator(): (data: unknown) => ValidationResult {
  if (!cachedValidator) {
    cachedValidator = createValidator(buildAjvSchema(SCHEMA));
  }
  return cachedValidator;
}
