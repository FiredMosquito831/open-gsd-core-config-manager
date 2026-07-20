---
phase: 06-live-schema-reconcile-against-gsd-core
plan: 04
subsystem: schema-refresh-security-contracts
tags: [security, tar, ast, markdown, fixtures, vitest]
requires:
  - phase: 06-01
    provides: "reject-tar dependency-free archive-reader decision"
  - phase: 06-02
    provides: "pure reconciliation contracts"
provides:
  - "Complete commit-pinned official GitHub archive compatibility fixture with 2,702 entries"
  - "Failing-first inert AST, documentation-evidence, and archive inspector test contracts"
  - "Executable 4,096-entry global archive cap"
affects: [06-05, 06-06, schema-refresh]
tech-stack:
  added: []
  patterns:
    - "Frozen fixtures define untrusted upstream parser behavior without network access."
    - "Archive contents are retained only for four exact required paths."
key-files:
  created:
    - test/fixtures/schema-refresh/official-github-archive.tar.gz
    - test/server/capability-registry-parser.test.ts
    - test/server/documentation-evidence-parser.test.ts
    - test/server/upstream-archive.test.ts
  modified:
    - .planning/phases/06-live-schema-reconcile-against-gsd-core/06-04-PLAN.md
    - .planning/phases/06-live-schema-reconcile-against-gsd-core/06-RESEARCH.md
key-decisions:
  - "The global archive entry cap is 4,096, allowing the complete 2,702-entry official fixture while retaining all other resource caps."
  - "The dependency-free archive branch remains constrained to the frozen official format and hostile-entry rejection matrix."
requirements-completed: [SCHEMA-05]
coverage:
  - id: D1
    description: "Frozen archive and hostile parser contracts for inert schema-refresh evidence."
    requirement: SCHEMA-05
    verification:
      - kind: unit
        ref: "npx vitest run test/server/capability-registry-parser.test.ts test/server/documentation-evidence-parser.test.ts test/server/upstream-archive.test.ts"
        status: unknown
    human_judgment: true
    rationale: "This is intentional RED-phase coverage; production parser modules are introduced by Plan 06-05."
metrics:
  duration: "unknown"
  completed_date: "2026-07-20"
status: complete
---

# Phase 06 Plan 04: Frozen Upstream Parser Contracts Summary

Frozen, commit-pinned GitHub archive compatibility plus failing-first security contracts for inert AST, Markdown evidence, and bounded archive inspection.

## Accomplishments

- Checked in the complete official `v1.7.0` commit-pinned GitHub archive fixture (`b1c9381b7abbf443f16c197118236b45cdd0486a`), containing 2,702 entries and unrelated safe regular files.
- Added valid source fixtures and hostile test matrices for literal-only capability registry parsing, deterministic documentation evidence, and allowlist-only archive retention.
- Raised the executable global archive entry cap from 64 to 4,096 while preserving compressed, decompressed, per-file, retained-byte, depth, metadata/header, and timeout caps.

## Task Commits

1. **Task 1: Create frozen upstream fixtures and hostile parser/archive tests** — `f5954b7` (test)

## Verification

`npx vitest run test/server/capability-registry-parser.test.ts test/server/documentation-evidence-parser.test.ts test/server/upstream-archive.test.ts` failed as expected solely because all three Plan 06-05 production modules are absent:

- `packages/server/src/capability-registry-parser.js`
- `packages/server/src/documentation-evidence-parser.js`
- `packages/server/src/upstream-archive.js`

The plan command's trailing `-x` is not accepted by Vitest 4.1.10, so verification was run without it.

## Files Created/Modified

- `test/fixtures/schema-refresh/official-github-archive.tar.gz` — complete frozen official archive fixture.
- `test/fixtures/schema-refresh/valid/*` — inert valid manifest, registry, and documentation inputs.
- `test/server/capability-registry-parser.test.ts` — literal AST allowlist and rejection contract.
- `test/server/documentation-evidence-parser.test.ts` — normalized per-key evidence and ambiguity contract.
- `test/server/upstream-archive.test.ts` — four-path retention, format compatibility, hostile-entry, and resource-cap contract.
- `.planning/phases/06-live-schema-reconcile-against-gsd-core/06-04-PLAN.md` — records 4,096 as the plan's executable entry cap.
- `.planning/phases/06-live-schema-reconcile-against-gsd-core/06-RESEARCH.md` — aligns initial-cap research wording with the confirmed cap.

## Decisions Made

- Used the user-confirmed 4,096 global entry cap because the complete official fixture has 2,702 entries.
- Retained all non-entry caps and every path, type, link, PAX/GNU, duplicate, and required-file defense unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Tooling] Corrected the obsolete Vitest verification flag**
- **Found during:** Task 1 verification.
- **Issue:** Vitest 4.1.10 rejects the plan's `-x` argument as an unknown option.
- **Fix:** Re-ran the exact three contract files without `-x`.
- **Files modified:** None.
- **Verification:** The suites failed only for the intended absent production modules.
- **Commit:** Not applicable.

**Total deviations:** 1 tooling correction.
**Impact on plan:** No implementation scope changed; the intended RED gate was confirmed.

## Known Stubs

None. The absent parser modules are intentional failing-first TDD targets owned by Plan 06-05, not shipped stubs.

## Next Phase Readiness

Plan 06-05 can implement the three production modules against the frozen fixture set. It must preserve the 4,096 global archive entry cap and all existing fail-closed protections.

## Self-Check: PASSED

- Found: `test/fixtures/schema-refresh/official-github-archive.tar.gz`
- Found: `test/server/capability-registry-parser.test.ts`
- Found: `test/server/documentation-evidence-parser.test.ts`
- Found: `test/server/upstream-archive.test.ts`
- Found task commit: `f5954b7`
