---
phase: 6
slug: live-schema-reconcile-against-gsd-core
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:ordinary -- --run test/server/schema-route.test.ts test/schema-data/completeness.test.ts` |
| **Full suite command** | `npm test && npm run typecheck && npm run build && npm pack --dry-run && npx vitest run test/packaging/tarball-contents.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` |
| **Estimated runtime** | To be measured during Wave 0 |

---

## Sampling Rate

- **After every task commit:** Run the focused Vitest file(s), plus `npm run typecheck` for contract changes
- **After every plan wave:** Run `npm run test:ordinary`
- **Before `/gsd-verify-work`:** `npm test && npm run typecheck && npm run build && npm pack --dry-run && npx vitest run test/packaging/tarball-contents.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` must be green
- **Max feedback latency:** Focused tests should complete within 60 seconds; measure and revise in Wave 0

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | SCHEMA-05 | Package legitimacy / incompatible fallback | Human selected `reject-tar`; package manifests remain tar-free and dependency-free reader compatibility is proved by frozen official fixture | checkpoint + preinstall gate | `node -e "const p=require('./package.json'); if(p.dependencies?.tar||p.devDependencies?.tar) process.exit(1)"` | ✅ | ✅ green |
| 06-02-01 | 02 | 1 | SCHEMA-05 | Curated metadata loss | Reconciliation preserves curated fields, flags prose drift, retains removed keys as deprecated, and ignores ordering/format noise | unit | `npm exec vitest -- run test/schema-data/reconcile.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ✅ | ✅ green |
| 06-02-02 | 02 | 1 | SCHEMA-05 | Bundled identity drift | Build emits and validates shipped bundled identity metadata while trusted-local loading stays isolated | unit/integration | `npm exec vitest -- run test/schema-data/reconcile.test.ts test/schema-data/completeness.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ✅ | ✅ green |
| 06-03-01 | 03 | 2 | SCHEMA-05 | Poisoned override persistence | Startup precedence, same-version identity conflict, activation atomicity, corrupt fallback, quarantine, and reset retain usable bundle | integration | `npm exec vitest -- run test/server/active-schema-manager.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ✅ | ✅ green |
| 06-03-02 | 03 | 2 | SCHEMA-05 | Split active generations | One-envelope manager compiles/persists before one snapshot swap and resets durably before bundle switch | integration | `npm exec vitest -- run test/server/active-schema-manager.test.ts test/server/schema-route.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ✅ | ✅ green |
| 06-04-01 | 04 | 3 | SCHEMA-05 | Archive traversal / format mismatch / remote code | Frozen official archive passes; only four bodies retained; safe unrelated contents discarded; malicious paths/types/metadata fail closed; literal AST and docs fixtures inert/network-free | contract/unit/security | `npm exec vitest -- run test/server/upstream-archive.test.ts test/server/capability-registry-parser.test.ts test/server/documentation-evidence-parser.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ✅ | ✅ green |
| 06-05-01 | 05 | 4 | SCHEMA-05 | Remote code / documentation ambiguity | AST and Markdown implementations satisfy inert literal, deterministic per-key evidence, ambiguity, and resource-cap contracts | unit/security | `npm exec vitest -- run test/server/capability-registry-parser.test.ts test/server/documentation-evidence-parser.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ✅ | ✅ green |
| 06-05-02 | 05 | 4 | SCHEMA-05 | Archive traversal / dependency branch mismatch | Dependency-free reader validates all bounded headers, four fixed contents, discarded safe bodies, official fixture, hostile entries, and compressed/decompressed limits | unit/security | `npm exec vitest -- run test/server/upstream-archive.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ✅ | ✅ green |
| 06-06-01 | 06 | 5 | SCHEMA-05 | Mutable identity / partial proposal | Stable client rejects invalid identity/evidence; streaming compressed and decompressed caps fail closed without an activatable proposal | unit | `npm exec vitest -- run test/server/schema-refresh.test.ts test/server/upstream-archive.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ✅ | ✅ green |
| 06-06-02 | 06 | 5 | SCHEMA-05 | Curated prose overwrite | Production overlays preserve curation; activation then second refresh yields only the corresponding documentation note | integration | `npm exec vitest -- run test/server/schema-refresh.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ✅ | ✅ green |
| 06-07-01 | 07 | 6 | SCHEMA-05 | Unauthorized activation / split generations | Guarded API rejects selectors/content; serialized lifecycle preserves retryable proposal and reset cancels stale proposal | API integration | `npm exec vitest -- run test/server/schema-route.test.ts test/server/active-schema-manager.test.ts test/server/schema-refresh.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ✅ | ✅ green |
| 06-07-02 | 07 | 6 | SCHEMA-05 | Bypassed schema authority | Config and history operations consume one manager snapshot per transaction | integration | `npm exec vitest -- run test/server/config-routes.test.ts test/server/history-route.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ✅ | ✅ green |
| 06-08-01 | 08 | 7 | SCHEMA-05 | Stale or misleading UI | Workspace shows source, version, bundled generated date, documentation notes, no-op, explicit activation/reset, remount hydration, and coherent cache switching | component | `npm exec vitest -- run test/web/schema-workspace.test.tsx --reporter=dot` | ✅ | ✅ green |
| 06-08-02 | 08 | 7 | SCHEMA-05 | Split client generations | Activation/reset reload schema and active config; schema mode retains a single main landmark | component/integration | `npm exec vitest -- run test/web/schema-workspace.test.tsx test/web/app-shell.test.tsx --reporter=dot` | ✅ | ✅ green |
| 06-09-01 | 09 | 8 | SCHEMA-05 | Live/package regression | Opt-in inert live compatibility plus build and extracted-tarball smoke prove bundled schema/status identity load without repository-source lookup | system + human | `npm run build && npm exec vitest -- run test/packaging/tarball-contents.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/server/schema-refresh.test.ts` — injected GitHub responses, production overlays, documentation drift across activation/second refresh, streaming compressed cap, and deterministic lifecycle failures
- [x] `test/server/upstream-archive.test.ts` — complete official archive acceptance, four-path-only retention/discard, malicious path/type/metadata rejection, malformed/duplicate/wrong-type cases, and compressed/decompressed caps
- [x] `test/server/capability-registry-parser.test.ts` — inert literal acceptance and prohibited-syntax rejection
- [x] `test/server/documentation-evidence-parser.test.ts` — heading/anchor/key association, normalization, ambiguity, evidence-unavailable, and prose-only fingerprint isolation
- [x] `test/fixtures/schema-refresh/official-github-archive.tar.gz` — complete frozen real official GitHub source archive including unrelated safe files
- [x] `test/schema-data/reconcile.test.ts` — curation, deprecation, and semantic-diff fixtures
- [x] `test/server/active-schema-manager.test.ts` — persistence, compilation, version precedence, fallback, quarantine, and reset
- [x] `test/web/schema-workspace.test.tsx` — staged UI, accessibility, bundled generated date, retained-proposal remount, and query invalidation
- [x] `test/fixtures/schema-refresh/` — frozen valid and adversarial fixtures; ordinary tests do not call live GitHub

**Wave 0 completion:** Complete. All identified Wave 0 artifacts exist and were exercised by the focused validation runs.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual hierarchy and responsive clarity of the reconcile review workspace | SCHEMA-05 | Automated component tests cannot fully judge density, wrapping, or hierarchy | Launch the app at desktop and compact widths; trigger fixture-backed added/changed/deprecated/no-op proposals; confirm provenance and action states remain readable without clipping or overlap |
| Dependency legitimacy checkpoint for `tar@7.5.20` | SCHEMA-05 | Human decision, not automatable | Completed: `reject-tar` was recorded in `06-01-SUMMARY.md`; verify future changes do not introduce `tar` without a new explicit approval |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verification or completed Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verification
- [x] Wave 0 covers all initially missing references
- [x] No watch-mode flags
- [x] Feedback latency: server-focused test batch completed in 103.02s under serialized slow-WSL-safe settings; individual server suites are suitable for feedback, while jsdom cold-start initialization is environment-bound
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated by adversarial automated audit; two visual/manual-only checks remain intentionally manual.

## Validation Audit 2026-07-21
| Metric | Count |
|--------|-------|
| Gaps found | 5 |
| Resolved | 5 |
| Escalated | 0 |

Added production-path behavioral coverage for default curation/specialized overlays, documentation drift after activation and a second refresh, streaming compressed and bounded decompressed archive limits, retained-proposal remount/activation, and schema-mode's single main landmark. Focused server suites passed with `--pool=forks --maxWorkers=1 --no-file-parallelism`; jsdom suites passed with the configured default runner because explicit pool overrides exceeded worker startup limits in this WSL environment. The opt-in live check remained skipped as designed (`GSD_LIVE_SCHEMA_COMPAT` unset). Build plus extracted-tarball smoke passed.
