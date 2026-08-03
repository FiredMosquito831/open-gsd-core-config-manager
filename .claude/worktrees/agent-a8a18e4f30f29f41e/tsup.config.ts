import { defineConfig } from 'tsup';

/**
 * Bundles the npm `bin` entry (`packages/cli/src/cli.ts`) into a single
 * `dist/cli.js`. See 02-07-PLAN.md's `<bundling_reality_check>`: this repo
 * has no npm workspaces, so `packages/**` sources are plain relative
 * imports that esbuild inlines automatically — there is no
 * `@gsd-config-manager/*` package name to add to `noExternal` (02-RESEARCH.md
 * Pitfall 4's tsup example is corrected here; do not reintroduce that key).
 *
 * `clean: true` wipes the whole `dist/` tree before writing `dist/cli.js`.
 * That is only safe because `package.json`'s `build` script runs this
 * (`build:cli`) BEFORE `build:client` (which writes `dist/client/**` and
 * only ever cleans that one subdirectory) — reverse that order and this
 * step deletes the freshly built client bundle.
 */
export default defineConfig({
  entry: ['packages/cli/src/cli.ts'],
  // `open@11` is ESM-only (no CJS export) and this repo is already
  // `"type": "module"` — CJS output is not an option here.
  format: ['esm'],
  platform: 'node',
  // Matches `engines.node >= 20.19` from package.json.
  target: 'node20',
  clean: true,
  // `cli.ts` reaches the rest of the app via a dynamic `import('./cli-main.js')`
  // (see cli.ts's header comment — that's a deliberate `require`-shim
  // ordering trick, not a lazy-load boundary). Without `splitting: false`,
  // esbuild's default ESM code-splitting emits that dynamic import as a
  // SEPARATE chunk file (`dist/cli-main-<hash>.js`), which both violates the
  // "single dist/cli.js" contract this plan requires and would need every
  // one of those hashed chunk filenames added to `package.json`'s `files`
  // allowlist. Disabling splitting inlines the whole import graph into the
  // one `dist/cli.js` output file.
  splitting: false,
  // No `dts` — the published artifact is an executable, not a library.
  // No `minify` — a readable stack trace in a bug report beats a few KB saved.
});
