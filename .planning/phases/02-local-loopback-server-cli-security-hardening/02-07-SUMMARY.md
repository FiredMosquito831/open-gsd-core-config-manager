---
phase: 02-local-loopback-server-cli-security-hardening
plan: 07
subsystem: packaging
tags: [tsup, esbuild, npm-pack, tarball, bin, shebang, esm, distribution, dist-client, windows-signals]

# Dependency graph
requires:
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: "02-06: packages/cli/src/{cli.ts,cli-main.ts,bootstrap.ts,output.ts} — the require-shim bin entry and bootstrap() this plan bundles into dist/cli.js"
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: "02-05: packages/server/src/schema.ts — the JSON-module schema import that lets esbuild inline bundled-schema.json (no runtime file resolution), which the extracted-tarball smoke run proves works"
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: "02-03: scripts/build-client.mjs and the frozen dist/client/** output contract this plan's composite build and files allowlist depend on"
provides:
  - "tsup.config.ts — single-entry ESM bundle of packages/cli/src/cli.ts into one dist/cli.js (splitting:false, shebang preserved, packages/** inlined, real npm deps external)"
  - "package.json publishing surface — private removed, version 0.1.0, bin, files allowlist, build:cli/build/prepublishOnly scripts (build order load-bearing)"
  - "test/packaging/tarball-contents.test.ts — 5 behaviors: 4 npm-pack-contents assertions + the extracted-tarball smoke run that boots the real packed artifact outside the repo"
  - "packages/cli/src/bootstrap.ts — defaultClientRoot() now resolves dist/client under BOTH the from-source and the bundled layout"
affects: ["Phase 3 (replaces scripts/build-client.mjs with a Vite build — the build script order (build:cli then build:client) and the dist/client/** files allowlist entry must be preserved verbatim, or the composite build silently ships a blank page)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build order as a safety invariant: tsup (clean: true, wipes all of dist/) MUST run before build:client (cleans only dist/client). The ordering is encoded in the `build` script and commented in tsup.config.ts — reversing it deletes the client bundle and ships a blank page to every npx user."
    - "Explicit `files` allowlist (dist/cli.js, dist/client/**) rather than an .npmignore denylist — a denylist fails open on every newly added directory."
    - "Extracted-tarball smoke run as the load-bearing packaging check: pack -> extract to os.tmpdir() -> junction-symlink node_modules -> boot the real dist/cli.js -> assert served UI + guarded API + clean shutdown. `npm pack --dry-run` only proves a file is on disk; only running the extracted artifact proves the bundle RESOLVES."

key-files:
  created:
    - tsup.config.ts
    - test/packaging/tarball-contents.test.ts
  modified:
    - package.json
    - packages/cli/src/bootstrap.ts

key-decisions:
  - "Added `splitting: false` to tsup.config.ts (not in the plan's config sketch). cli.ts reaches the rest of the app via a DYNAMIC `import('./cli-main.js')` — that is 02-06's deliberate require-shim ordering trick, not a lazy-load boundary. esbuild's default ESM code-splitting honors it literally and emits a second hashed chunk file (`dist/cli-main-<hash>.js`), which both breaks the single-dist/cli.js contract and would require every hashed chunk name in the `files` allowlist. Disabling splitting inlines the whole graph into one output file."
  - "Did NOT add a `noExternal` entry, per the plan's <bundling_reality_check>: this repo has no npm workspaces and no @gsd-config-manager/* package names — packages/** are relative imports esbuild inlines automatically. 02-RESEARCH.md Pitfall 4's prescription was moot here and adding it would have been a dead (and misleading) config line."
  - "The extracted-tarball smoke run triggers shutdown via the IPC-message fallback 02-06 already shipped in registerSignalHandlers(), not child_process.kill('SIGINT') — same reason as 02-06 (Windows child_process.kill() performs an unconditional TerminateProcess for every signal name in this console-less sandbox). Task 4's human checkpoint is the designated ground truth for genuine OS signal delivery, and it passed."
  - "Did not run `npm publish`. Building and packing was the plan's scope; publishing is the user's call."

patterns-established:
  - "Any check that only ever runs from source inside the repo cannot validate a bundled artifact's runtime path resolution. Every `import.meta.url`/`__dirname`-relative path in code destined for the bundle must be exercised by the extracted-tarball smoke run — the in-repo suite is structurally blind to this class of bug (see Deviations)."

requirements-completed: [DIST-03, DIST-04]

coverage:
  - id: D1
    description: "`npm run build` produces both dist/cli.js (executable, shebang preserved) and dist/client/index.html, in an order where neither step destroys the other"
    requirement: "DIST-03"
    verification:
      - kind: unit
        ref: "npm run build (exit 0); both artifacts present afterwards; tsup.config.ts's clean:true runs first, build-client.mjs's dist/client-scoped clean second"
        status: pass
      - kind: unit
        ref: "node -e shebang/inline/external assertion on dist/cli.js (starts with #!/usr/bin/env node, no relative packages/ import survives, fastify stays a bare specifier)"
        status: pass
      - kind: unit
        ref: "node dist/cli.js --help (exit 0, lists --port and --no-open)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The published tarball contains dist/cli.js and dist/client/index.html and nothing else — no source, tests, planning artifacts, web/, scripts/, or node_modules"
    requirement: "DIST-03"
    verification:
      - kind: unit
        ref: "test/packaging/tarball-contents.test.ts#contains the built CLI entry"
        status: pass
      - kind: unit
        ref: "test/packaging/tarball-contents.test.ts#contains the built UI"
        status: pass
      - kind: unit
        ref: "test/packaging/tarball-contents.test.ts#ships no source, tests, or planning artifacts"
        status: pass
      - kind: unit
        ref: "test/packaging/tarball-contents.test.ts#the bin entry points at a file that is actually shipped"
        status: pass
    human_judgment: false
  - id: D3
    description: "The packed tarball, extracted outside the repo, actually boots: serves the bundled UI unguarded from the extracted location, answers the token-guarded API, and exits 0 on shutdown — proving no packages/** source or schema import was left dangling in the bundle"
    requirement: "DIST-01, DIST-03, DIST-04"
    verification:
      - kind: integration
        ref: "test/packaging/tarball-contents.test.ts#the packed tarball runs from a clean extraction (npm pack -> tar extract to os.tmpdir() -> junction-symlinked node_modules -> spawn dist/cli.js -> GET / 200 with the built HTML byte-for-byte -> GET /api/health 200 with x-gsd-token -> exit 0 + ordered shutdown copy)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The tool is publishable: private:true removed, bin and files declared, version 0.1.0, and the build runs automatically before packing (prepublishOnly)"
    requirement: "DIST-03"
    verification:
      - kind: unit
        ref: "node -e publish-fields assertion (no private, bin['gsd-config-manager'] present, files is an array, build + prepublishOnly scripts present) prints 'publish fields ok'"
        status: pass
      - kind: unit
        ref: "write-file-atomic still pinned at exactly 7.0.1 (bare exact version, no ^/~)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A real Ctrl-C in a real Windows terminal stops the tool cleanly: ordered shutdown copy, prompt returns, port freed, no lock file, no orphan process"
    requirement: "DIST-04"
    verification:
      - kind: other
        ref: "Task 4 blocking human checkpoint — human executed a physical Ctrl-C in a real Windows terminal and confirmed all ten checks (banner copy, browser auto-open, connected placeholder page, ?t= stripped from the address bar, ordered shutdown copy, prompt returned, no LISTENING entry on the port, no .lock directory in the snapshot root, no orphan node.exe). Response: 'approved'."
        status: pass
    human_judgment: true
    rationale: "02-VALIDATION.md's designated Manual-Only verification. Windows has no real POSIX signals — child_process.kill('SIGINT') is emulated and is not the same event as a physical console Ctrl-C (02-RESEARCH.md Pitfall 3), and this sandboxed shell has no attached Win32 console to deliver one. Automation is structurally incapable of closing this; explicit human sign-off is the ground truth, and it also retires the outstanding human-verification item that 02-06's IPC-fallback deviation left open."
  - id: D6
    description: "Full repo regression suite and typecheck stay green after packaging"
    verification:
      - kind: integration
        ref: "npm test (102/102 passed, 15 files), npx tsc --noEmit (exit 0)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-13
status: complete
---

# Phase 02 Plan 07: Packaging & Distribution Summary

**The working tool is now a shippable public npm package: one tsup-bundled `dist/cli.js` (shebang intact, `packages/**` and the schema inlined, real deps external) plus the built UI, asserted programmatically in the tarball and proven to actually boot from a clean extraction outside the repo — a check that immediately caught a real bundled-path bug every from-source test was structurally blind to.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-13
- **Tasks:** 4 (3 auto, 1 blocking human checkpoint)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Built `tsup.config.ts`: single entry (`packages/cli/src/cli.ts`) → single `dist/cli.js`, ESM (`open@11` is ESM-only), `platform: 'node'`, `target: 'node20'` (matching `engines.node >= 20.19`), `clean: true`. No `dts` (the artifact is an executable, not a library), no `minify` (a readable stack trace in a bug report beats a few KB). No `noExternal` — the plan's `<bundling_reality_check>` was right: `packages/**` are relative imports esbuild inlines automatically, and the `@gsd-config-manager/*` package names 02-RESEARCH.md's Pitfall 4 prescribed do not exist in this repo.
- Flipped `package.json` to publishable: removed `private: true`, set `version: 0.1.0`, added `bin: { "gsd-config-manager": "./dist/cli.js" }` (standard `bin` + shebang, never `pkg`/SEA, per CLAUDE.md), added the `files` allowlist (`dist/cli.js`, `dist/client/**` — nothing else), and wired `build:cli` (tsup) → `build` (`build:cli && build:client`, order load-bearing) → `prepublishOnly` (`build`).
- Built `test/packaging/tarball-contents.test.ts` with 5 behaviors: four parse `npm pack --dry-run --json` and assert the CLI entry ships, the built UI ships, no `packages/`/`test/`/`.planning/`/`web/`/`scripts/` path ships, and the declared `bin` path is actually in the tarball; the fifth packs a **real** tarball, extracts it into `os.tmpdir()` outside the repo, junction-symlinks `node_modules` in, spawns the extracted `dist/cli.js`, and asserts `GET /` returns the built client HTML byte-for-byte, `GET /api/health` returns `ok: true` with the `x-gsd-token` header, and the process exits 0 with the ordered shutdown copy.
- Verified end to end: `npm run build` exits 0 and produces both artifacts; `npx vitest run test/packaging/tarball-contents.test.ts` is 5/5; `npm test` is 102/102 across 15 files; `npx tsc --noEmit` exits 0; the packed tarball is 3 files / 21.3 KB (`dist/cli.js`, `dist/client/index.html`, `package.json`).
- **Task 4 (human checkpoint): approved.** A human executed a physical Ctrl-C in a real Windows terminal and confirmed all ten checks — banner copy, browser auto-open, connected placeholder page, `?t=` stripped from the address bar, "Shutting down…" then "Server stopped. Port released, no changes lost." in that order, prompt returned with no hang, port released (no LISTENING entry), no stranded `.lock` directory, no orphan `node.exe`. This closes DIST-04's ground truth.

## Task Commits

Each task was committed atomically:

1. **Task 1: tsup config — bundle the CLI to dist/cli.js** - `00dc781` (feat)
2. **Task 2: Publishing fields, composite build, tarball-contents assertions** - `bce7a27` (feat)
3. **Task 3: Extracted-tarball smoke run (+ the Rule-1 bundled-path fix)** - `8d218c8` (feat)
4. **Task 4: Manual real-terminal Ctrl-C smoke test** - human-approved, no code change

## Files Created/Modified

- `tsup.config.ts` - Single-entry ESM bundle → `dist/cli.js`; `splitting: false`; documents why the build order and the absent `noExternal` key are both deliberate
- `package.json` - `private` removed, `version: 0.1.0`, `bin`, `files` allowlist, `build:cli`/`build`/`prepublishOnly` scripts
- `test/packaging/tarball-contents.test.ts` - 4 tarball-contents assertions + the extracted-tarball smoke run
- `packages/cli/src/bootstrap.ts` - `defaultClientRoot()` fixed to resolve `dist/client` under both the from-source and the bundled layout (see Deviations)

## Decisions Made

- **`splitting: false`** (not in the plan's config sketch). `cli.ts` reaches the app via a **dynamic** `import('./cli-main.js')` — 02-06's deliberate `require`-shim ordering trick, not a lazy-load boundary. esbuild's default ESM code-splitting takes it literally and emits a second hashed chunk (`dist/cli-main-<hash>.js`), which breaks the single-`dist/cli.js` contract and would force every hashed chunk name into the `files` allowlist. Disabling splitting inlines the whole graph into one file.
- **No `noExternal` key.** Confirmed the plan's reality check against the repo: no workspaces, no per-package `package.json`, all `packages/**` imports relative. Adding the 02-RESEARCH.md entry would have been a dead and actively misleading config line.
- **The smoke run's shutdown trigger is the IPC-message fallback**, not `child_process.kill('SIGINT')` — the identical constraint 02-06 documented (Windows `kill()` = unconditional `TerminateProcess` for every signal name in this console-less sandbox). The production `shutdown()`/`registerSignalHandlers()` code path exercised is the same one either way; Task 4's human checkpoint is the ground truth for genuine OS signal delivery, and it passed.
- **Did not run `npm publish`** — out of scope; publishing is the user's call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `defaultClientRoot()` resolved `dist/client` correctly from source and incorrectly from the bundle**

- **Found during:** Task 3, first run of the extracted-tarball smoke run — `GET /` returned the dev-nudge page ("The client build has not run yet…") instead of the built client HTML, from a tarball that provably *contained* `dist/client/index.html`.
- **Issue:** `packages/cli/src/bootstrap.ts`'s `defaultClientRoot()` computed `join(__dirname, '..', '..', '..', 'dist', 'client')` — correct for the from-source layout, where the module sits at `packages/cli/src/` (three levels below the repo root). But tsup inlines `bootstrap.ts`'s code **directly into `dist/cli.js`**, so at runtime in the published artifact `__dirname` is `dist/` itself, and `dist/client` is a **direct sibling**. The old math therefore walked three levels *above* the package root and landed outside the installed package entirely. `registerStatic()` then found no `index.html`, silently skipped `@fastify/static`, and served the dev-nudge fallback — meaning **every `npx` user would have gotten a placeholder page instead of the app**, from a tarball that passed every content assertion.
- **Fix:** `defaultClientRoot()` now probes the bundled sibling path (`__dirname/client`) first and falls back to the from-source math only if it doesn't resolve — resolving by what's actually on disk rather than branching on how the process was launched.
- **Files modified:** `packages/cli/src/bootstrap.ts`
- **Verification:** Smoke run's `GET /` now returns the extracted `dist/client/index.html` byte-for-byte; `npm test` 102/102; `npx tsc --noEmit` exit 0.
- **Commit:** `8d218c8`

**Why this one matters (lesson, not a footnote):** this bug was **invisible to all 97 pre-existing tests**, and would have remained invisible to any number of additional in-repo tests, because every one of them runs the CLI *from source* — where `__dirname` is always the source-layout path and the old math is always right. The class of bug (an `import.meta.url`/`__dirname`-relative path that only misresolves *after bundling*) is structurally undetectable from inside the repo. It was caught within seconds of the first extracted-tarball run. `npm pack --dry-run` would never have caught it either — the file was present in the tarball; the *code looking for it* was wrong. **Any path resolution in code destined for the bundle must be exercised by the extracted-artifact smoke run.** Plan 02-05 had already anticipated exactly this class of landmine for the schema (`packages/server/src/schema.ts`'s JSON-module import, T-02-26) and pre-empted it; the client root was the same landmine, un-defused. The smoke run is the only thing standing between this repo and shipping a blank page.

---

**Total deviations:** 1 auto-fixed (Rule 1 — a real, user-facing bug in the shipped artifact)
**Impact on plan:** None on scope. The fix is 8 lines in a file the plan did not list under `files_modified`, but it is squarely inside Task 3's stated purpose ("the only check that catches a bundling gap") — the task found the gap it was written to find.

## Issues Encountered

Two Windows-environment quirks surfaced while writing the smoke run; both are environmental, not design problems:

- GNU `tar` on Windows misparses a `C:\...` drive-letter path as a remote `host:path` archive. Fixed with `--force-local` plus POSIX-style forward slashes in the paths handed to `tar`.
- `execFileSync('npm', [...], { shell: true })` triggers Node's DEP0190 deprecation warning (shell concatenates unescaped array args). Replaced with a single fixed command string (never built from external input), which avoids that code path entirely.

## User Setup Required

None for the tool to run. **To actually publish**, the user must run `npm publish` themselves — deliberately not run here. `prepublishOnly` will rebuild both artifacts automatically at that point, so the tarball can never ship a stale `dist/`.

## Next Phase Readiness

- **Phase 3 must preserve two invariants** when it swaps `scripts/build-client.mjs` for a real Vite build: (1) the `build` script order (`build:cli` before `build:client` — tsup cleans all of `dist/`, the client step cleans only `dist/client`; reversing them deletes the CLI bundle), and (2) the `dist/client/**` entry in `package.json`'s `files` allowlist plus the `dist/client/index.html` output path. Both are asserted by `test/packaging/tarball-contents.test.ts`, which will go red if either is broken.
- `bootstrap.ts`'s `defaultClientRoot()` now handles both layouts, so a Vite build writing to `dist/client` needs no change there.
- DIST-01, DIST-02, DIST-03, DIST-04 are all closed. The outstanding human-verification item 02-06 flagged (real-terminal Ctrl-C) is retired by Task 4's sign-off.
- No blockers. Phase 2 is complete and the tool is packable, installable, and provably runnable from the published tarball.

---
*Phase: 02-local-loopback-server-cli-security-hardening*
*Completed: 2026-07-13*
