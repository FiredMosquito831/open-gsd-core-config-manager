#!/usr/bin/env node
/**
 * cli.ts — the npm `bin` entry (DIST-01).
 *
 * This file is deliberately a thin shim, NOT the place Commander/bootstrap
 * logic lives (that's `cli-main.ts`). Two Node/tsx-runtime quirks force this
 * split, neither of which touches the frozen `packages/config-io` package:
 *
 *   1. A top-level `await` in this ESM entry, combined with the frozen
 *      `packages/config-io/src/validate.ts`'s TypeScript `import X =
 *      require(...)` form (its own documented workaround for an
 *      Ajv/ajv-formats CJS-interop typecheck gap), trips Node's/tsx's
 *      module-format-ambiguity detector (`ERR_AMBIGUOUS_MODULE_SYNTAX`)
 *      when this CLI is run from source via tsx
 *      (`test/server/helpers/spawn-cli.ts`).
 *   2. Once top-level await is removed, `validate.ts`'s plain `require(...)`
 *      call still needs a global `require` to exist. `tsc`'s NodeNext
 *      compiler auto-inserts a `createRequire` shim for exactly this
 *      import-equals pattern when compiling to ESM output, but tsx/esbuild
 *      (used both here for from-source test spawning and later by tsup for
 *      the packaged bundle) does not replicate that insertion.
 *
 * Fix: shim `globalThis.require` HERE, synchronously, before anything else
 * loads — then reach the real logic via a DYNAMIC `import()` (never a
 * static one), so validate.ts's module body — reached transitively through
 * `cli-main.ts` -> `bootstrap.ts` -> the server's config-io imports — only
 * evaluates after the shim is already in place. A dynamic import also keeps
 * this file itself free of both top-level await and `require(` syntax, so
 * the ambiguity detector never has a reason to fire on this file either.
 */
import { createRequire } from 'node:module';

const globalWithRequire = globalThis as typeof globalThis & { require?: NodeJS.Require };
if (typeof globalWithRequire.require === 'undefined') {
  globalWithRequire.require = createRequire(import.meta.url);
}

import('./cli-main.js')
  .then((mod) => mod.main(process.argv))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
