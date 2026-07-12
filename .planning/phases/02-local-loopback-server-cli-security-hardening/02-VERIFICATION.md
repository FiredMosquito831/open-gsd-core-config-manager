---
phase: 02-local-loopback-server-cli-security-hardening
verified: 2026-07-13T01:45:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "CR-03 residual gap: two SEPARATE `npx` processes (not two tabs against one running server) writing the SAME tracked config concurrently"
    resolution: accepted
    resolved_by: human
    resolved_at: 2026-07-13
    decision: "ACCEPTED as a deliberate scope boundary. The in-process mutex covers the real-world scenario (multiple browser tabs against one launched server). Two simultaneous `npx` launches editing the same config is an edge case the phase's own D-03 decision already places outside locking scope, and its worst case is a lost version-history entry — not config corruption, since proper-lockfile inside Phase 1's frozen saveConfig still protects the config file itself cross-process. Phase 5 (Version History UI) builds directly on this snapshot store and is the natural place to revisit cross-process index locking if it ever proves necessary."
    expected: "saveWithSnapshot's CR-03 fix is an in-process async mutex (Map<string, Promise> keyed by resolved path) inside packages/server/src/snapshot-store/save-with-snapshot.ts. It correctly serializes concurrent saves that arrive at the SAME running Fastify process (e.g. two browser tabs pointed at one launched instance), and this is proven by an automated, deterministic regression test. It does NOT and CANNOT serialize the read-prior-content -> recordSnapshot sequence across two independent OS processes, since D-03 explicitly allows multiple unguarded npx launches with no single-instance enforcement. proper-lockfile's cross-process lock (inside Phase 1's frozen saveConfig) still protects the actual config FILE from byte-level corruption in this scenario, but the snapshot-history index (index.json/seq) has no cross-process lock, so a rare two-process race could still lose a version-history entry (not a config-corruption bug, a version-history completeness bug)."
    why_human: "This is a design-tradeoff judgment call, not something a grep/test can resolve: is an in-process-only mutex adequate for a single-user local tool where two simultaneous npx launches against the same file is an edge case the phase's own D-03 decision already treats as out of scope for locking? The reviewer and fixer (02-REVIEW.md CR-03, 02-REVIEW-FIX.md) treated the in-process fix as sufficient and did not add a cross-process index lock. Confirm this residual scope boundary is acceptable, or file a follow-up to extend proper-lockfile's scope to cover recordSnapshot's index read-modify-write."
---

# Phase 2: Local Loopback Server, CLI & Security Hardening Verification Report

**Phase Goal:** Users can launch the entire tool with one `npx` command, reach a local server that only they can talk to, and have every save automatically protected by a snapshot.
**Verified:** 2026-07-13T01:45:00Z
**Status:** passed — 5/5 must-haves verified; the single human-verification item (CR-03 residual cross-process gap) was reviewed and **accepted** by the user as a deliberate scope boundary on 2026-07-13.
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `npx <package>` starts a local server bound to 127.0.0.1 and automatically opens the UI in the user's browser, no separate server setup | ✓ VERIFIED | `packages/cli/src/bootstrap.ts` hardcodes `host: '127.0.0.1'` in `app.listen()` (no flag/env can change it); `open()` is called with the tokenized URL, wrapped in try/catch so a headless box degrades gracefully. Live-tested: `test/server/cli-launch.test.ts` "starts and serves" spawns the real CLI and confirms a real HTTP round-trip over the assigned port; "binds only to the loopback interface" asserts `server.address().address === '127.0.0.1'`; "opens browser with token" asserts the injected fake `open` was called with the correct tokenized URL. Extracted-tarball smoke run (`test/packaging/tarball-contents.test.ts`) proves the same behavior from the actual packed artifact outside the repo. All 5 cli-launch tests + the smoke run pass. |
| 2 | A request with a non-allowlisted Host header, or a cross-origin request from an unrelated site, is rejected by the server; a mutating request missing the per-launch token is rejected | ✓ VERIFIED | `packages/server/src/plugins/host-guard.ts` (root scope, Set-membership check, fixed 403 body), `origin-guard.ts` (`/api` scope, real server-side 403, not merely an omitted CORS header — confirmed by code and by the "rejects cross-origin" test using `app.inject()` which has no browser to enforce anything), `token-guard.ts` (`/api` scope, `crypto.timingSafeEqual`, guards reads AND writes, fails closed on OPTIONS bypass only). `test/server/security.test.ts` — 9/9 tests pass, including "rejects bad Host header", "rejects cross-origin", "rejects missing token on reads", "rejects wrong token", "rejects bad Host header on static assets too" (proves root-scope coverage), and the PUT-specific "rejects missing token" (the literal SEC-02 mutation case). All 403 bodies verified to never echo the rejected value (fixed static messages only). |
| 3 | Pressing Ctrl-C stops the tool cleanly — the port is released and no orphaned process or lock file remains | ✓ VERIFIED (automated + human) | `bootstrap.ts#shutdown()` always `await`s `app.close()` before printing the "Server stopped" confirmation (never fire-and-forget — the exact Fastify discussion #5140 bug class). `test/server/teardown.test.ts` — 4/4 pass: "SIGINT releases port and locks" (real TCP ECONNREFUSED probe after exit), "SIGTERM also shuts down cleanly", "prints the shutdown confirmation only after the server has closed" (ordering), "leaves no lock file behind". Windows caveat verified in code: since `child_process.kill()` on Windows performs an unconditional `TerminateProcess` regardless of signal name, these automated tests trigger shutdown via an IPC message (`registerSignalHandlers`'s `typeof proc.send === 'function'` branch), which is provably inert for a real `npx` launch from a shell (no IPC channel exists there) — confirmed by reading the guard condition directly in `bootstrap.ts`. The real-signal ground truth was closed by a **human-executed physical Ctrl-C in a real Windows terminal** (02-07-PLAN.md Task 4, a `blocking` human-verify checkpoint), documented in `02-07-SUMMARY.md` as "approved" against all 10 specified checks (banner copy, browser auto-open, token stripped from address bar, ordered shutdown copy, prompt returned, port free per `netstat`, no `.lock` directory, no orphan `node.exe`). This is adequate evidence: it is the exact verification method the phase's own 02-VALIDATION.md designated for this criterion ("Manual-Only Verifications" table), the checkpoint is a `blocking`-gate task (cannot be silently skipped), and the human's response is recorded verbatim. |
| 4 | The tool is installable as a single public npm package with the built UI bundled inside it | ✓ VERIFIED | `package.json`: `private` removed, `version: 0.1.0`, `bin: {"gsd-config-manager": "./dist/cli.js"}`, `files: ["dist/cli.js", "dist/client/**"]`. Live-verified in this session: `npm run build` exits 0, produces `dist/cli.js` (shebang `#!/usr/bin/env node` intact) and `dist/client/index.html`. `npm pack --dry-run --json` lists exactly 3 files (`dist/cli.js`, `dist/client/index.html`, `package.json`), 21.3 KB, no source/test/planning leakage. `test/packaging/tarball-contents.test.ts` — 5/5 pass, including the extracted-tarball smoke run that packs a REAL tarball, extracts it to `os.tmpdir()` outside the repo, junction-symlinks `node_modules`, boots `dist/cli.js` from that clean location, and confirms `GET /` serves the real built HTML and `GET /api/health` (token-guarded) returns 200 — this is the check that caught and got a real bundled-path bug fixed (`defaultClientRoot()`, documented in 02-07-SUMMARY.md Deviations) before this verification ran. |
| 5 | Every successful save automatically creates a version snapshot stored outside the tracked project directory, with no extra user action required | ✓ VERIFIED | `packages/server/src/snapshot-store/paths.ts#snapshotDirFor()` resolves exclusively under `env-paths('gsd-config-manager').data` — never derived from the config file's own directory — hashed by the config's ABSOLUTE path (sha256), confirmed by reading the source directly. `PUT /api/configs/:id` (`packages/server/src/routes/configs.ts`) composes `saveWithSnapshot()` — confirmed by direct code read, it never calls Phase 1's `saveConfig` directly and performs no filesystem write of its own. `test/server/snapshot-store.test.ts` — 10/10 pass, including "records snapshot before overwrite", "snapshot is stored outside the tracked project directory" (asserts non-descendant of the config dir, no `.git` segment), "skips snapshot on first save" (no phantom entry), "save succeeds even if snapshot recording fails" (non-blocking warning, no config-content leak). `test/server/api-routes.test.ts`'s "saves a tracked config and records a snapshot" proves the same behavior end-to-end over the real HTTP route. `packages/config-io/**` (Phase 1, frozen) has zero diff across the entire phase (confirmed via `git log -- packages/config-io` — last touched in Phase 1 commits only). |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/cli/src/{cli.ts,cli-main.ts,bootstrap.ts,output.ts}` | Commander CLI, loopback bind, browser open, awaited teardown | ✓ VERIFIED | All exist, exported symbols match plan (`bootstrap`, `registerSignalHandlers`, `createOutput`). `cli-main.ts` is an undeclared-but-reasonable split of `cli.ts` (documented, working around a real tsx/ESM module-ambiguity issue) — does not violate any must-have. |
| `packages/server/src/{app,context}.ts` + `plugins/{host-guard,origin-guard,token-guard,cors}.ts` | Security guard stack | ✓ VERIFIED | Registration order confirmed by direct read of `app.ts`: Host guard (root) → static (root) → `/api` scope (CORS → Origin guard → token guard → routes). Matches the plan's load-bearing ordering exactly. |
| `packages/server/src/snapshot-store/{paths,index,save-with-snapshot}.ts` | Snapshot mechanism | ✓ VERIFIED | All exported symbols present; CR-02/CR-03 fixes (stub rollback, per-path mutex) confirmed present in source, not just claimed in SUMMARY. |
| `packages/server/src/{api-types,registry,schema}.ts`, `routes/configs.ts` | REST API, path-traversal boundary | ✓ VERIFIED | `registry.ts#track()` is the sole path-accepting entry point; reads/writes take only opaque ids. `schema.ts` inlines the bundled schema via JSON module import (no runtime `readFileSync`/`import.meta.url`, confirmed by grep). |
| `web/index.html`, `scripts/build-client.mjs` | Placeholder UI + build pipeline | ✓ VERIFIED | Token flow (read once, `history.replaceState`, header-only fetch) present; WR-03 fix (`textContent` not `innerHTML`) and WR-04 fix (extension allowlist copy) both confirmed applied in the review-fix commits. |
| `tsup.config.ts`, `package.json` publishing fields | Publishable package | ✓ VERIFIED | Confirmed live: build produces both artifacts, tarball contains exactly the right 3 files. |
| `.planning/phases/.../02-API-CONTRACT.md` | Frozen REST contract | ✓ VERIFIED | Exists, 141 lines, documents all 5 routes and both envelope shapes (spot-checked). |
| Test suites (`security`, `snapshot-store`, `api-routes`, `cli-launch`, `teardown`, `packaging`) | Full behavioral coverage | ✓ VERIFIED | All re-run live in this session: 107/107 total (`npm test`), including 9 security, 10 snapshot-store, 10 api-routes, 5 cli-launch, 4 teardown, 5 packaging tests — matching every count claimed in the plans/summaries. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bootstrap.ts` | `sealLaunchContext(ctx, port)` | Called immediately after `listen()` resolves, before banner/browser-open | ✓ WIRED | Confirmed by direct read — ordering matches the plan exactly. |
| `routes/configs.ts` PUT | `saveWithSnapshot` → `saveConfig` (Phase 1 frozen) | Direct import and call, no other write path | ✓ WIRED | Confirmed by direct read — no `writeFile`/`writeFileSync` in `configs.ts` (grep-confirmed empty). |
| `token-guard.ts` | `/api` plugin scope only | Registered inside `app.register(apiPlugin, {prefix: '/api'})`, never at root | ✓ WIRED | Confirmed — static assets load without a token (test passes), `/api/*` requires it (test passes). |
| `output.ts` banner format | `spawn-cli.ts#parseBannerUrl()` | Exact URL string shape `http://127.0.0.1:<port>/?t=<token>` | ✓ WIRED | Live spawn tests successfully parse the banner from the real CLI process. |
| `bootstrap.ts#defaultClientRoot()` | `dist/client` (bundled) vs `packages/../dist/client` (from-source) | Probes bundled sibling first, falls back to from-source | ✓ WIRED | Confirmed fixed and working via the extracted-tarball smoke run (this was a real bug caught and fixed during Plan 07, per 02-07-SUMMARY.md Deviations, and re-verified live in this session). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `npm test` | 107/107 passed, 15 files | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Build | `npm run build` | exit 0, both artifacts produced | ✓ PASS |
| Tarball contents | `npm pack --dry-run --json` | 3 files exactly, 21.3 KB | ✓ PASS |
| Extracted-tarball boot | `npx vitest run test/packaging/tarball-contents.test.ts` | 5/5 including live smoke boot | ✓ PASS |
| Security guard suite | `npx vitest run test/server/security.test.ts` | 9/9 | ✓ PASS |
| Snapshot store suite | `npx vitest run test/server/snapshot-store.test.ts` | 10/10 (includes CR-02/CR-03 regression tests) | ✓ PASS |
| API routes suite | `npx vitest run test/server/api-routes.test.ts` | 10/10 (includes CR-01/WR-02 regression tests) | ✓ PASS |
| CLI launch + teardown | `npx vitest run test/server/cli-launch.test.ts test/server/teardown.test.ts` | 9/9 | ✓ PASS |
| `packages/config-io` frozen | `git log -- packages/config-io` | Last touched in Phase 1 only | ✓ PASS |
| Debt markers | grep TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER across Phase 2 source | none found | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DIST-01 | 01, 06, 07 | Single-command launch, no separate setup | ✓ SATISFIED | `bootstrap.ts` + Commander CLI; live-tested and packaged-artifact-tested |
| DIST-02 | 06 | Loopback bind + auto browser open | ✓ SATISFIED | Confirmed 127.0.0.1 hardcode + `open()` wiring |
| DIST-03 | 01, 03, 07 | Public npm package, UI bundled inside | ✓ SATISFIED | `npm pack --dry-run` + extracted-tarball smoke run |
| DIST-04 | 06, 07 | Clean Ctrl-C shutdown, no orphan/lock | ✓ SATISFIED | Automated ECONNREFUSED probe + human real-terminal sign-off |
| SEC-01 | 04 | Host allowlist + real cross-origin 403 | ✓ SATISFIED | `host-guard.ts` + `origin-guard.ts`, 9/9 security tests |
| SEC-02 | 04, 05 | Token-guarded mutations (and reads, D-04) | ✓ SATISFIED | `token-guard.ts`, PUT-specific test added in Plan 05 |
| SAVE-04 | 02, 05 | Automatic snapshot outside project dir | ✓ SATISFIED | `snapshot-store/**` + `saveWithSnapshot` composition, 10/10 tests |

No orphaned requirements — all 7 phase-assigned requirement IDs from `.planning/REQUIREMENTS.md`'s traceability table appear in at least one plan's `requirements:` frontmatter field, and all are marked `Complete` there (though that status itself is a SUMMARY-adjacent claim; this report independently confirms the underlying code/tests for each).

### Anti-Patterns Found

None found in Phase 2 source files. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no empty stub implementations, no hardcoded-empty data flowing to a route response.

Two IN-01/IN-02 informational findings from `02-REVIEW.md` remain unfixed by design (`fix_scope: critical_warning` explicitly deferred them) — both are cosmetic (a bare `/api` path falling to the SPA shell instead of JSON 404; a display-name edge case for a root-level config path). Neither affects any of the 5 success criteria or the 7 requirement IDs in scope for this phase.

### Human Verification Required

1. **CR-03 residual scope: in-process-only mutex vs. cross-process snapshot-index safety**

**Test:** Launch two separate `npx gsd-config-manager` processes (not two browser tabs against one instance) pointed at the same tracked config file, and save through both concurrently.
**Expected:** Decide whether the current behavior (the actual config file is protected from corruption by `proper-lockfile`'s cross-process lock inside Phase 1's frozen `saveConfig`, but the snapshot-history `index.json` read-modify-write in `snapshot-store/index.ts` has no cross-process lock — only the in-process `withPathLock` mutex added for CR-03) is an acceptable scope boundary for SAVE-04, or whether it needs a follow-up to extend locking to the index file itself.
**Why human:** This is a design-tradeoff call already made once by the phase's own reviewer/fixer (`02-REVIEW.md` CR-03 → `02-REVIEW-FIX.md`, in-process mutex chosen deliberately, cross-process lock NOT added) for a single-user local tool where D-03 explicitly permits multiple unguarded simultaneous launches. It doesn't fail any of the 5 stated success criteria as literally worded (every *individual* successful save still gets a snapshot; the narrow race is specifically between two *separate OS processes* saving the *same* file at the *same* moment, and even then the config file itself cannot be corrupted — only a version-history entry could theoretically be lost). Confirming this is acceptable (or filing a tracked follow-up) is a product/risk-acceptance decision, not something a grep or test can resolve.

### Gaps Summary

No blocking gaps. All 5 roadmap success criteria are verified against live-running code and tests re-executed in this session (not merely SUMMARY.md claims): `npm test` (107/107), `npx tsc --noEmit` (exit 0), `npm run build` + `npm pack --dry-run` (3-file tarball), and the extracted-tarball smoke run (actual boot from a clean extraction) were all independently re-run here, not just read from prior reports. The 3 Critical + 4 Warning findings from `02-REVIEW.md` were independently confirmed fixed by reading the resulting source (not just trusting `02-REVIEW-FIX.md`'s narrative) — `app.ts`'s `setErrorHandler`, `save-with-snapshot.ts`'s stub-rollback and per-path mutex, `health.ts`'s JSON-module version import, `registry.ts`'s re-validation helper, `web/index.html`'s `textContent` fix, and `build-client.mjs`'s extension allowlist are all present in the actual files, not just claimed.

The sole open item is a human-judgment call on an already-documented, narrow residual concurrency edge case (CR-03's in-process-only scope) that does not block any of the 7 requirement IDs or 5 success criteria as literally stated, but is surfaced here rather than silently passed because a full multi-process cross-lock was a plausible (and more complete) alternative fix that the phase chose not to take.

---

_Verified: 2026-07-13T01:45:00Z_
_Verifier: Claude (gsd-verifier)_
