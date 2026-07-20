---
phase: 06-live-schema-reconcile-against-gsd-core
plan: 05
subsystem: schema-refresh-security
status: complete
tags: [typescript-ast, node-zlib, tar, markdown, security]
requires:
  - phase: 06-01
    provides: "reject-tar decision and dependency-free reader constraint"
  - phase: 06-04
    provides: "frozen archive fixture and failing-first parser contracts"
provides:
  - "Inert AST-only capability registry parser"
  - "Per-key normalized documentation evidence fingerprints"
  - "Bounded dependency-free official archive inspector"
affects: [06-06, schema-refresh]
tech-stack:
  added: []
  patterns:
    - "Remote source is reduced through AST and archive structural allowlists, never executed."
    - "Archive inspector retains only exact allowlisted evidence files."
key-files:
  created:
    - packages/server/src/capability-registry-parser.ts
    - packages/server/src/documentation-evidence-parser.ts
    - packages/server/src/upstream-archive.ts
  modified:
    - test/server/capability-registry-parser.test.ts
key-decisions:
  - "The recorded reject-tar decision is honored: no package manifests were changed."
  - "The bounded reader supports only USTAR plus the frozen archive's inert global PAX comment/mtime metadata."
requirements-completed: [SCHEMA-05]
coverage:
  - id: D1
    description: "Remote capability registry and documentation are parsed inertly into bounded structural evidence."
    requirement: SCHEMA-05
    verification:
      - kind: unit
        ref: "test/server/capability-registry-parser.test.ts and test/server/documentation-evidence-parser.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pinned archive validation scans the complete official fixture and retains only four required regular files."
    requirement: SCHEMA-05
    verification:
      - kind: unit
        ref: "test/server/upstream-archive.test.ts"
        status: pass
    human_judgment: false
metrics:
  duration: "31 min"
  completed_date: "2026-07-20"
---

# Phase 06 Plan 05: Inert Upstream Trust Boundary Summary

AST-only registry parsing, isolated Markdown fingerprints, and a dependency-free bounded GitHub archive inspector provide a non-executing evidence boundary for schema refresh.

## Accomplishments

- Added a TypeScript compiler-AST literal parser that rejects executable and prototype-sensitive source while producing null-prototype data.
- Added deterministic Markdown evidence association and SHA-256 fingerprints, with explicit unavailable diagnostics for ambiguous or missing documentation.
- Added a `node:zlib` USTAR inspector that validates every entry, accepts the 2,702-entry frozen official archive, and retains only four required bodies.
- Preserved the human-approved `reject-tar` branch: neither `package.json` nor `package-lock.json` changed.

## Task Commits

1. **Task 1: Implement inert structural and documentation parsers** — `75bc2f6` (feat)
2. **Task 2: Implement the approved bounded archive branch** — `436272a` (feat)

## Verification

- Passed: `npx vitest run test/server/upstream-archive.test.ts test/server/capability-registry-parser.test.ts test/server/documentation-evidence-parser.test.ts` — 37 tests passed.
- `npm run typecheck` compiles the new server code, but remains blocked by pre-existing `test/web/phase4-catalog-evidence.test.ts` Node-type errors under `tsconfig.web.json`.

## Files Created/Modified

- `packages/server/src/capability-registry-parser.ts` — AST-allowlisted inert literal reader.
- `packages/server/src/documentation-evidence-parser.ts` — normalized isolated documentation evidence and diagnostics.
- `packages/server/src/upstream-archive.ts` — bounded gzip/USTAR inspector with allowlist-only retention.
- `test/server/capability-registry-parser.test.ts` — corrects a stale assertion for the supplied current registry fixture.

## Decisions Made

- The global PAX record in the frozen official archive is accepted only when it carries bounded `comment` or `mtime` metadata; it cannot alter paths or entry types.
- Safe unrelated regular files are consumed without exposure; all unsafe paths, types, metadata, or malformed content fail closed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test fixture drift] Corrected stale valid-fixture assertion**
- **Found during:** Task 1 verification.
- **Issue:** The current frozen registry fixture does not contain `model_profile`, causing the failing-first test's validity assertion to reject its own fixture.
- **Fix:** Asserted the fixture's present `workflow.ai_integration_phase` registry entry instead.
- **Files modified:** `test/server/capability-registry-parser.test.ts`
- **Verification:** Parser suite passes all valid and hostile contracts.
- **Committed in:** `75bc2f6`

**Total deviations:** 1 auto-fixed Rule 1 issue.
**Impact on plan:** Corrected test fixture alignment without reducing parser coverage or security scope.

## Known Stubs

None.

## Deferred Issues

- `npm run typecheck` currently fails on the pre-existing `test/web/phase4-catalog-evidence.test.ts` missing Node typings in the web TypeScript project. This is outside this plan's files; parser and archive contract tests pass.

## Next Phase Readiness

Plan 06-06 can consume four bounded archive bodies as inert reconciliation inputs. The official compatibility gate is green and no remote source is executed or extracted.

## Self-Check: PASSED

- Found: `packages/server/src/capability-registry-parser.ts`
- Found: `packages/server/src/documentation-evidence-parser.ts`
- Found: `packages/server/src/upstream-archive.ts`
- Found task commits: `75bc2f6`, `436272a`
