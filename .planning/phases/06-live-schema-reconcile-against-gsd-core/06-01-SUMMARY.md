---
phase: 06-live-schema-reconcile-against-gsd-core
plan: 01
subsystem: schema-refresh
status: complete
tags: [security, dependency-gate, archive-reader, schema-refresh]
requires: []
provides:
  - "Durable reject-tar decision for Plan 06-04"
  - "Dependency-free bounded node:zlib archive-reader branch"
affects: [06-04-PLAN.md, package.json, package-lock.json]
tech-stack:
  added: []
  patterns:
    - "Explicit human dependency-legitimacy gates"
    - "Fail-closed official archive-format compatibility gate"
key-files:
  created:
    - .planning/phases/06-live-schema-reconcile-against-gsd-core/06-01-SUMMARY.md
  modified: []
decisions:
  - "reject-tar: do not add tar@7.5.20 to the runtime dependency graph."
  - "Plan 06-04 must implement a dependency-free bounded node:zlib archive reader and prove frozen official GitHub archive-format fixture compatibility before acquisition or proposal work."
  - "If exact safe compatibility cannot be proven while retaining required rejections, stop and escalate for a new human decision; do not reduce SCHEMA-05."
metrics:
  duration: "0 min"
  completed_date: "2026-07-20"
---

# Phase 06 Plan 01: Archive Dependency Decision Summary

The human rejected `tar@7.5.20`; schema refresh will use a dependency-free bounded `node:zlib` archive-reader branch, with mandatory proof against the frozen official GitHub archive-format fixture before any acquisition or proposal work.

## Decision Recorded

**Accepted resume signal:** `reject-tar`

`tar@7.5.20` is rejected and must not enter either the runtime or development dependency graph. No dependency was installed and neither package manifest was changed.

## Required Downstream Contract

Plan 06-04 must implement a dependency-free bounded reader using `node:zlib`. It must prove compatibility with the frozen fixture captured from the official, commit-pinned GitHub archive format before it begins archive acquisition or schema proposal work.

The reader may support only the exact PAX/GNU metadata records demonstrated by that frozen fixture, with bounded record length and count and immediate-next-entry application. It must retain strict header, checksum, type, path, size, and time enforcement, and reject:

- links and unsafe or traversal paths;
- special or sparse entries;
- duplicate required entries;
- unsupported metadata records;
- malformed headers, checksums, or padding; and
- all compressed/decompressed, entry-count, per-file, and timeout cap violations.

If this exact safe official-format compatibility cannot be proven, Phase 6 execution must stop and escalate for a new human decision. It must not use an archive reader that rejects the official fixture, and it must not reduce the SCHEMA-05 acceptance surface.

## Verification

- `node -e "const p=require('./package.json'); if(p.dependencies?.tar||p.devDependencies?.tar) process.exit(1)"` exits successfully.
- `package.json` has no `tar` dependency.
- `package-lock.json` root package dependency lists have no `tar` entry.
- No package installation or implementation-file modification occurred.

## Deviations from Plan

None - plan executed exactly as written. The plan's `reject-tar` branch explicitly requires the recorded dependency-free reader contract and escalation condition.

## Known Stubs

None.

## Self-Check: PASSED

- Found: `.planning/phases/06-live-schema-reconcile-against-gsd-core/06-01-SUMMARY.md`
- Found task decision commit: `f9fdedb`
- Found execution metadata commit: `d27acb1`
- Manifest verification confirmed neither root dependency list nor the lockfile contains `tar`.
