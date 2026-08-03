---
phase: 02-local-loopback-server-cli-security-hardening
fixed_at: 2026-07-12T22:30:07Z
review_path: .planning/phases/02-local-loopback-server-cli-security-hardening/02-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-07-12T22:30:07Z
**Source review:** .planning/phases/02-local-loopback-server-cli-security-hardening/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (3 Critical, 4 Warning — `fix_scope: critical_warning`; IN-01/IN-02 out of scope by design)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Uncaught filesystem/parse errors leak absolute paths back to the client

**Files modified:** `packages/server/src/app.ts`, `test/server/api-routes.test.ts`
**Commit:** `ab829f9`
**Applied fix:** Added a project-wide `app.setErrorHandler` in `buildApp()` that maps any Fastify `validation` error to a generic 400 and every other unexpected thrown error to a generic path-free 500 (`{ ok: false, errors: [{ message: 'Internal error' }] }`), logging the real error (including any embedded absolute path) server-side only via the existing `warn` sink. Verified the four security guards (host/origin/token) all call `reply.code(403).send(...)` directly rather than throwing, so this handler never intercepts or weakens their 403 envelopes — confirmed by re-running the full `security.test.ts` suite unmodified (still 9/9 green). Added a regression test in `api-routes.test.ts` that corrupts a tracked config's on-disk JSON (forcing `load()`'s path-embedding parse error) and asserts the response is a generic 500 whose body contains neither the absolute config path nor its parent directory.

### CR-02: New-config validation failure leaves a permanent stray 0-byte file with no cleanup

**Files modified:** `packages/server/src/snapshot-store/save-with-snapshot.ts`, `test/server/snapshot-store.test.ts`
**Commit:** `2bdad4c`
**Applied fix:** Added a `stubCreated` flag set only when `saveWithSnapshot` itself creates the pre-touch empty stub for a brand-new config path. If the subsequent `saveConfig` call throws (validation failure or otherwise), and `stubCreated` is true, the stub is unlinked (best-effort, swallowing unlink errors) before the error/soft-failure is handled — never touching a pre-existing user file, since `stubCreated` is only ever true when this exact call created it. Added a regression test asserting a failed first-ever save of a brand-new config path leaves no file on disk at all (previously left a 0-byte stray file).

### CR-03: Concurrent saves to the same tracked config can silently lose a version-history entry

**Files modified:** `packages/server/src/snapshot-store/save-with-snapshot.ts`, `test/server/snapshot-store.test.ts`
**Commit:** `9676d11`
**Applied fix:** Added an in-process async mutex (`withPathLock`, a `Map<string, Promise<unknown>>`-based queue keyed by `resolve(configPath)`) that serializes the ENTIRE `saveWithSnapshot` orchestration (read-prior-content → `saveConfig` → `recordSnapshot`) per resolved config path — not merely the write itself, which `proper-lockfile` already covers. This is purely an in-process guard scoped to this one file; `config-io` is untouched and `proper-lockfile`'s cross-process advisory lock inside `saveConfig` is unchanged. Added a deterministic regression test (`concurrent saves never lose a distinct historical state to the read-before-lock race`) that drives two concurrent saves and asserts, order-independently, that the union of both recorded snapshot contents plus the final on-disk content contains exactly 3 distinct states (original + both writes) — i.e. no historical state is silently dropped. **Verified this test is load-bearing**: manually disabling the lock reproduced the failure (`expected 2 to be 3`, i.e. one distinct state lost) before re-enabling the fix, which passes cleanly (~30ms, no artificial delays needed since the race is in the always-concurrent pre-lock read).

### WR-01: `/api/health` always reports version `0.0.0` in the packaged/npx artifact

**Files modified:** `packages/server/src/routes/health.ts`, `test/packaging/tarball-contents.test.ts`
**Commit:** `d600dc0`
**Applied fix:** Replaced the `__dirname`-relative four-level `package.json` walk with a JSON-module import (`import pkg from '../../../../package.json' with { type: 'json' }`) — the exact bundle-safe pattern `schema.ts` already uses for the bundled schema, inlined by tsup/esbuild at build time with no runtime path resolution at all. Confirmed the built `dist/cli.js` now contains the literal `"0.1.0"` version string. Extended the existing extracted-tarball smoke run (the only test that exercises the bundled artifact from outside the repo) to assert `healthBody.version` matches the real `package.json` version and is never the `'0.0.0'` fallback sentinel.

### WR-02: `registry.ts#track()` never re-validates a path after tracking

**Files modified:** `packages/server/src/registry.ts`, `packages/server/src/routes/configs.ts`, `test/server/api-routes.test.ts`
**Commit:** `c067bcd`
**Applied fix:** Added an exported `isRegularFileOrMissing()` helper in `registry.ts` (returns `true` for a not-yet-existing path — legitimate for the "create new config" PUT flow — or an existing regular file; `false` only when something non-regular now sits at the path). Wired a re-check into both the `GET` and `PUT /api/configs/:id` handlers in `configs.ts`, returning the same static `"Unknown tracked config id"` 404 rather than relying solely on CR-01's generic error handler. Added a regression test that swaps a tracked config's path for a directory after tracking and asserts the same path-free 404.

### WR-03: `web/index.html` renders a server-supplied field via `innerHTML`

**Files modified:** `web/index.html`
**Commit:** `6ec76ef`
**Applied fix:** Changed `setStatus()` to use `statusEl.textContent` instead of `statusEl.innerHTML`. All existing call sites already pass plain text (no HTML markup), so behavior is visually identical; verified by rebuilding and re-running the packaging suite (byte-identical `dist/client/index.html` output aside from this one change).

### WR-04: `scripts/build-client.mjs` ships everything under `web/` into the tarball with no allow/deny filter

**Files modified:** `scripts/build-client.mjs`
**Commit:** `25215c2`
**Applied fix:** Replaced the blanket `cpSync(srcDir, outDir, { recursive: true })` with a `copyAllowed()` walker that only copies files whose extension is on a fixed allowlist of real web-bundle asset types (`.html`, `.js`, `.mjs`, `.css`, `.json`, image/font formats), logging and skipping anything else — including extension-less dotfiles like `.env` (whose `path.extname()` is the empty string and therefore never matches). Manually verified: a stray `web/.env.test` file is now skipped with a logged warning instead of being copied into `dist/client`; the real `index.html` output remains byte-identical to before.

## Skipped Issues

None — all 7 in-scope findings (3 Critical, 4 Warning) were fixed. IN-01 and IN-02 were explicitly out of scope for this pass per the workflow's `fix_scope: critical_warning` setting and are left for a future pass.

## Verification

- `npx tsc --noEmit`: exits 0 (verified in the isolated worktree during fix application, and again in the main repo after the worktree fast-forward + cleanup).
- `npm test`: 107/107 passing (up from the 102/102 baseline — 5 new regression tests added: 1 for CR-01, 1 for CR-02, 2 for CR-03, 1 for WR-01's version assertion extending an existing test, 1 for WR-02). Verified in both the isolated worktree and the main repo post-cleanup.
- `git diff --name-only -- packages/config-io/`: empty in both locations — the frozen Phase 1 package was never touched. All fixes were made at the Phase 2 composition layer (`packages/server/**`), the CLI bundling layer (`scripts/build-client.mjs`), or the static bootstrap page (`web/index.html`), per the hard constraints.
- `test/server/security.test.ts`'s 9 guard tests (bad Host → 403, cross-origin → 403, missing/wrong token → 403, valid token → 200, static unguarded, bad Host on static → 403, SPA fallback → 200) all still pass unmodified — CR-01's `setErrorHandler` never intercepts them since the guards `reply.send()` directly rather than throwing.
- All version strings in `package.json` remain unchanged, bare, exact (no `^`/`~`); `write-file-atomic` stays `7.0.1`. No new dependency was installed — CR-03's fix is a pure in-process JS mutex requiring no library.

**Operational note:** this fix run used an isolated git worktree with a Windows directory-junction symlink to share `node_modules` for running `tsc`/`vitest` without a full reinstall. `git worktree remove --force` recursed through that junction and emptied the *target* `node_modules` directory in the main repository (a Windows-junction-handling gotcha, not a source-code issue). This was caught immediately during post-cleanup verification and remediated with `npm ci` in the main repo before finalizing this report; the final `tsc`/`npm test`/`git diff` verification above was re-run in the main repo after the reinstall and is clean. No source files, `package.json`, or `package-lock.json` were affected — only the (regenerable) `node_modules` directory contents.

---

_Fixed: 2026-07-12T22:30:07Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
