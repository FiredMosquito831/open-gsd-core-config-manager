---
phase: 6
slug: live-schema-reconcile-against-gsd-core
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 06-01-01 | 01 | 1 | SCHEMA-05 | Package legitimacy / incompatible fallback | Human selects approve-tar or reject-tar; rejection requires frozen official-format compatibility and blocks/escalates if safe support cannot be proven | checkpoint + automated preinstall gate | `node -e "const p=require('./package.json'); if(p.dependencies?.tar||p.devDependencies?.tar) process.exit(1)"` | ✅ existing | ⬜ pending |
| 06-02-01 | 02 | 1 | SCHEMA-05 | Curated metadata loss | Reconciliation preserves curated fields, flags prose drift, retains removed keys as deprecated, and ignores ordering/format noise | unit | `npx vitest run test/schema-data/reconcile.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | SCHEMA-05 | Bundled identity drift | Build emits and validates shipped bundled identity metadata while trusted-local loading stays isolated | unit/integration | `npx vitest run test/schema-data/reconcile.test.ts test/schema-data/completeness.test.ts -x` | ⚠️ partial | ⬜ pending |
| 06-03-01 | 03 | 2 | SCHEMA-05 | Poisoned override persistence | Startup precedence, same-version identity conflict, activation atomicity, corrupt fallback, quarantine, and reset retain usable bundle | integration | `npx vitest run test/server/active-schema-manager.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | SCHEMA-05 | Split active generations | One-envelope manager compiles/persists before one snapshot swap and resets durably before bundle switch | integration | `npx vitest run test/server/active-schema-manager.test.ts test/server/schema-route.test.ts -x` | ⚠️ partial | ⬜ pending |
| 06-04-01 | 04 | 3 | SCHEMA-05 | Archive traversal / format mismatch / remote code | A complete frozen official archive with unrelated safe regular files passes: every header is validated under global caps, only four exact required regular-file bodies are retained, safe unrelated bodies are discarded, and malicious non-allowlisted unsafe paths/types/metadata fail closed; literal AST and documentation fixtures remain inert and network-free | contract/unit/security | `npx vitest run test/server/upstream-archive.test.ts test/server/capability-registry-parser.test.ts test/server/documentation-evidence-parser.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-05-01 | 05 | 4 | SCHEMA-05 | Remote code / documentation ambiguity | AST and Markdown implementations satisfy inert literal, deterministic per-key evidence, ambiguity, and resource-cap contracts | unit/security | `npx vitest run test/server/capability-registry-parser.test.ts test/server/documentation-evidence-parser.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-05-02 | 05 | 4 | SCHEMA-05 | Archive traversal / dependency branch mismatch | Exact approved branch validates all bounded headers, retains only four fixed required contents, discards safe unrelated regular-file bodies while charging global caps, passes the complete official archive, and rejects hostile non-allowlisted unsafe entries without extraction or selector broadening | unit/security | `npx vitest run test/server/upstream-archive.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-06-01 | 06 | 5 | SCHEMA-05 | Mutable identity / partial proposal | Stable-release client rejects prerelease, draft, malformed, same-version conflict, and failed evidence without creating a proposal | unit | `npx vitest run test/server/schema-refresh.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-06-02 | 06 | 5 | SCHEMA-05 | Curated prose overwrite | Prose-only source change creates only corresponding documentation note and retains curated descriptor through proposal | integration | `npx vitest run test/server/schema-refresh.test.ts test/schema-data/reconcile.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-07-01 | 07 | 6 | SCHEMA-05 | Unauthorized activation / split generations | Guarded API rejects selectors/content and activation updates rendering plus authoritative validation together | API integration | `npx vitest run test/server/schema-route.test.ts test/server/active-schema-manager.test.ts test/server/schema-refresh.test.ts -x` | ⚠️ partial | ⬜ pending |
| 06-07-02 | 07 | 6 | SCHEMA-05 | Bypassed schema authority | Config and history operations consume one manager snapshot per transaction | integration | `npx vitest run test/server/config-routes.test.ts test/server/history-route.test.ts -x` | ✅ existing | ⬜ pending |
| 06-08-01 | 08 | 7 | SCHEMA-05 | Stale or misleading UI | Workspace shows source, version, date, review groups including documentation notes, no-op, explicit activation/reset, and coherent cache switching | component | `npx vitest run test/web/schema-workspace.test.tsx -x` | ❌ W0 | ⬜ pending |
| 06-08-02 | 08 | 7 | SCHEMA-05 | Split client generations | Activation/reset reload schema and active config before editor resume | component/integration | `npx vitest run test/web/schema-workspace.test.tsx test/server/schema-route.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-09-01 | 09 | 8 | SCHEMA-05 | Live/package regression | Opt-in inert live compatibility plus full suite/build/pack and the existing extracted-tarball smoke prove bundled schema and identity metadata load without repository-source lookup | system + human | `npm test && npm run typecheck && npm run build && npm pack --dry-run && npx vitest run test/packaging/tarball-contents.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` | ⚠️ partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/server/schema-refresh.test.ts` — injected GitHub responses and deterministic lifecycle failures
- [ ] `test/server/upstream-archive.test.ts` — complete official archive acceptance with safe unrelated regular files; four-path-only retention/discard assertions; malicious non-allowlisted unsafe path/type/metadata rejection; malformed header, duplicate/ambiguous required-path, wrong-type required-file, and hard-cap cases
- [ ] `test/server/capability-registry-parser.test.ts` — literal acceptance and prohibited-syntax rejection
- [ ] `test/server/documentation-evidence-parser.test.ts` — heading/anchor/key association, normalization, ambiguity, evidence-unavailable, and prose-only fingerprint isolation
- [ ] `test/fixtures/schema-refresh/official-github-archive.tar.gz` — complete frozen real official GitHub source archive, including unrelated safe regular files, as the compatibility gate for both dependency branches
- [ ] `test/schema-data/reconcile.test.ts` — curation, deprecation, and semantic-diff fixtures
- [ ] `test/server/active-schema-manager.test.ts` — persistence, compilation, version precedence, fallback, quarantine, and reset
- [ ] `test/web/schema-workspace.test.tsx` — staged UI, accessibility, status controls, and query invalidation
- [ ] `test/fixtures/schema-refresh/` — frozen valid and adversarial fixtures; ordinary tests must not call live GitHub

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual hierarchy and responsive clarity of the reconcile review workspace | SCHEMA-05 | Automated component tests cannot fully judge density, wrapping, or hierarchy | Launch the app at desktop and compact widths; trigger fixture-backed added/changed/deprecated/no-op proposals; confirm provenance and action states remain readable without clipping or overlap |
| Dependency legitimacy checkpoint for `tar@7.5.20`, if retained by the plan | SCHEMA-05 | Research returned a SUS legitimacy verdict requiring human approval | Review package provenance, current advisories, lockfile delta, and alternatives before installation; record approval or choose a dependency-free bounded parser strategy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s for focused checks
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
