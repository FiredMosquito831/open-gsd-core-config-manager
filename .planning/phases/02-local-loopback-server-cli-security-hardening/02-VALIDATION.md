---
phase: 2
slug: local-loopback-server-cli-security-hardening
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` §Validation Architecture. The Per-Task Verification Map
> is populated by the planner (task IDs do not exist until PLAN.md files are written).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` 4.1.10 (already configured from Phase 1) |
| **Config file** | `vitest.config.ts` (repo root, exists from Phase 1) |
| **Quick run command** | `npx vitest run test/server --reporter=dot` |
| **Full suite command** | `npm test` (runs `vitest run`, covers Phase 1 + Phase 2 suites) |
| **Estimated runtime** | ~quick <10s (inject/unit) · full ~30-60s (adds spawned-process tests) |

Note: security-rejection cases use `fastify.inject()` (no real listening socket, no `supertest`/`undici` dependency). Only the CLI-launch and teardown tests spawn a real process.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run test/server --reporter=dot` (fast unit/inject tests only; skip spawned-process integration during rapid iteration)
- **After every plan wave:** Run `npm test` (full suite, including spawned-process CLI-launch and teardown tests)
- **Before `/gsd-verify-work`:** Full suite must be green, PLUS one manual real-terminal Ctrl-C smoke test on Windows (see Manual-Only Verifications)
- **Max feedback latency:** ~10 seconds (quick loop)

---

## Per-Task Verification Map

> Populated by the planner during `/gsd-plan-phase`. Each task's `<automated>` verify command
> should map to a row below. The requirement→test seed map (from research) is:

| Req ID | Behavior | Test Type | Automated Command (seed) |
|--------|----------|-----------|--------------------------|
| DIST-01 | `npx <package>` starts with no separate setup | integration (spawned process) | `vitest run test/server/cli-launch.test.ts -t "starts and serves"` |
| DIST-02 | Binds 127.0.0.1, opens browser with token | integration (mock `open`) | `vitest run test/server/cli-launch.test.ts -t "opens browser with token"` |
| DIST-03 | Bundled UI ships in the npm tarball | build+pack assertion | `npm run build && npm pack --dry-run --json && vitest run test/packaging/tarball-contents.test.ts` |
| DIST-04 | Ctrl-C releases port + locks, no orphan | integration (spawn + SIGINT) | `vitest run test/server/teardown.test.ts -t "SIGINT releases port and locks"` |
| SEC-01 | Non-allowlisted Host header rejected (403) | unit (`fastify.inject()`) | `vitest run test/server/security.test.ts -t "rejects bad Host header"` |
| SEC-01 | Cross-origin request rejected | unit (`fastify.inject()` + `Origin`) | `vitest run test/server/security.test.ts -t "rejects cross-origin"` |
| SEC-02 | Mutating request without token rejected (403) | unit (`fastify.inject()`) | `vitest run test/server/security.test.ts -t "rejects missing token"` |
| SEC-02 | Read request without token also rejected (D-04, stricter) | unit (`fastify.inject()`) | `vitest run test/server/security.test.ts -t "rejects missing token on reads"` |
| SAVE-04 | Every successful save snapshots outside the project | integration (temp dir + stub app-data) | `vitest run test/server/snapshot-store.test.ts -t "records snapshot before overwrite"` |
| SAVE-04 | First-ever save skips gracefully (D-11) | integration | `vitest run test/server/snapshot-store.test.ts -t "skips snapshot on first save"` |
| SAVE-04 | Snapshot failure is non-fatal (D-12) | unit (failing recorder injected) | `vitest run test/server/snapshot-store.test.ts -t "save succeeds even if snapshot recording fails"` |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/server/security.test.ts` — Host-header, CORS-origin, and token-guard rejection cases via `fastify.inject()` — covers SEC-01, SEC-02
- [ ] `test/server/cli-launch.test.ts` — spawned-process test asserting the CLI binds, prints a URL, and calls `open` with the correct token — covers DIST-01, DIST-02
- [ ] `test/server/teardown.test.ts` — spawned-process `SIGINT` test asserting port release + lock cleanup + clean exit — covers DIST-04
- [ ] `test/server/snapshot-store.test.ts` — `saveWithSnapshot` orchestration against a temp dir + stubbed `env-paths` root — covers SAVE-04 (D-10, D-11, D-12)
- [ ] `test/packaging/tarball-contents.test.ts` — parses `npm pack --dry-run --json`, asserts `dist/client/index.html` and the `bin` entry are present — covers DIST-03
- [ ] Test helper `spawnCli(args): { proc, port, url }` — spawns the built CLI, waits for its "listening" stdout line (or written port file), resolves the port — needed by `cli-launch.test.ts` and `teardown.test.ts`
- [ ] Framework install: none — `vitest` already present from Phase 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-terminal Ctrl-C teardown on Windows 11 | DIST-04 | Windows SIGINT delivery is not POSIX-equivalent; `proper-lockfile` only auto-cleans on graceful exit, not on force-kill. Spawned-process tests approximate but a real Ctrl-C in the target terminal is the ground truth. | 1. `npx <package>` in a real Windows terminal. 2. Press Ctrl-C. 3. Confirm process exits, the port is free (`netstat`/re-launch on same port works), and no `.lock` file remains in the app-data snapshot dir. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < ~10s (quick loop)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-12 (verified by gsd-plan-checker against the 7 Phase 2 plans)
