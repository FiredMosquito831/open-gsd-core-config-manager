/**
 * Ajv 2020-12 validation layer (SAVE-01, success criterion #3).
 *
 * Two load-bearing details (01-RESEARCH.md § Decision: Ajv Setup, § Pitfall 2,
 * § Pitfall 4):
 *   1. Import `Ajv2020` from `ajv/dist/2020` — the default `Ajv` export is
 *      draft-07 and silently mis-validates a 2020-12 schema.
 *   2. The bundled schema's `x-*` vendor keywords are registered via
 *      `ajv.addKeyword({ keyword })` (metadata-only no-ops) rather than
 *      disabling strict mode wholesale, or `ajv.compile()` throws at startup.
 *
 * `additionalProperties` is never set to `false` here or by any schema this
 * module compiles — that decision lives in the schema documents themselves
 * (see 01-RESEARCH.md § Pitfall 5). A config carrying an unknown/future key
 * must always validate so newer-gsd-core keys never block a save.
 */
// NOTE: `ajv` and `ajv-formats` ship as CommonJS packages with no "exports"
// map, whose .d.ts files use ESM `export default` syntax for subpath/root
// entries. Under this project's `moduleResolution: NodeNext`, a plain ESM
// `import X from '...'` against those declarations resolves to the CJS
// module *namespace* type rather than the default export value, producing
// "This expression is not callable/constructable" at `tsc --noEmit` time
// even though the same import runs fine under vitest/esbuild. Using TS's
// `import ... = require(...)` form (which NodeNext compiles to a
// `createRequire` call that works correctly under Node's ESM loader)
// sidesteps the interop gap and yields the real default export's type. See
// 01-RESEARCH.md § Decision: Ajv Setup for the required import target
// (`ajv/dist/2020`, not the default draft-07 `ajv` export).
import ajv2020Module = require('ajv/dist/2020.js');
import ajvFormatsModule = require('ajv-formats');
import type { ErrorObject } from 'ajv';
import type { ValidationResult } from './types.js';

const Ajv2020 = ajv2020Module.default;
const addFormats = ajvFormatsModule.default;

/**
 * Metadata-only vendor keywords used by the bundled canonical schema.
 * Registered as no-op keywords so Ajv's strict mode does not reject the
 * schema's own extensions at compile time (01-RESEARCH.md § Pitfall 4).
 */
const VENDOR_KEYWORDS = [
  'x-category',
  'x-description',
  'x-provenance',
  'x-options',
  'x-dynamic-key-hint',
];

/**
 * Compiles a 2020-12 schema and returns a `validate(data)` closure typed to
 * `ValidationResult`. Never throws on invalid *data* — only a malformed
 * *schema* can throw, and only at compile time (see Pitfall 4).
 */
export function createValidator(schema: object): (data: unknown) => ValidationResult {
  // `allowUnionTypes: true` is required for the real bundled schema (Plan 02's
  // bundled-schema.json, converted to an Ajv-compilable tree by
  // schema-convert.ts's `buildAjvSchema`): many nullable-container entries
  // declare `type: ["object", "null"]`, and Ajv's strict mode rejects union
  // `type` arrays unless this option is set (01-07: discovered when the
  // round-trip-identity gate first compiled the real schema end-to-end —
  // the inline fixture schema in validate.test.ts never exercised a union
  // type, so this gap was invisible until Plan 07). A standard, valid JSON
  // Schema shape, not a strict-mode workaround for anything unsafe.
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  for (const keyword of VENDOR_KEYWORDS) {
    // Metadata-only: no validate/compile fn → always passes, just silences
    // strict-mode's unknown-keyword rejection for this keyword.
    ajv.addKeyword({ keyword });
  }
  const validateFn = ajv.compile(schema);

  return (data: unknown): ValidationResult => {
    const valid = validateFn(data) as boolean;
    return { valid, errors: (validateFn.errors ?? []) as object[] };
  };
}

/**
 * Renders Ajv errors for logging as short, log-safe strings containing only
 * `instancePath` + `keyword` + a static message. Never includes the
 * offending value — an Information Disclosure guard for secret-shaped
 * fields (01-RESEARCH.md § Security Domain).
 */
export function formatErrors(errors: object[]): string[] {
  return (errors as ErrorObject[]).map((err) => {
    const path = err.instancePath || '(root)';
    return `${path}: failed "${err.keyword}"`;
  });
}
