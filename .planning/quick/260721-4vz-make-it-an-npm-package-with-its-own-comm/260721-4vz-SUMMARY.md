---
phase: quick
plan: 01
quick_id: 260721-4vz
slug: make-it-an-npm-package-with-its-own-comm
subsystem: infra
tags: [npm, packaging, cli, bin-alias]

requires: []
provides:
  - "Second bin command `gsd-config-editor` mapping to the SAME shipped ./dist/cli.js as the existing `gsd-config-manager` bin (alias, both kept)."
affects: [dist, packaging, cli]

tech-stack:
  added: []
  patterns:
    - "Add a bin alias by mapping a second `package.json` `bin` key to an EXISTING shipped entry point — no new build, no new dependency, no lockfile change."

key-files:
  created:
    - ".planning/quick/260721-4vz-make-it-an-npm-package-with-its-own-comm/260721-4vz-PLAN.md"
  modified:
    - "package.json (bin object gained the gsd-config-editor alias key)"
    - "test/packaging/tarball-contents.test.ts (one new guard it inside the existing 'tarball contents (DIST-03)' describe)"

key-decisions:
  - "Add `gsd-config-editor` as an ALIAS bin, KEEP `gsd-config-manager` — locked user decision (chosen over package rename / data-dir migration to avoid stranding existing tracked files and snapshots under ~/.gsd-config-manager/)."
  - "Do NOT regenerate package-lock.json — a bin key is install-time npm metadata that adds no dependency and does not alter the resolved tree (verified untouched)."
  - "Leave `program.name('gsd-config-manager')` in cli-main.ts as-is — it is the program's internal `--help` identity, not the invocation command; aligning it is cosmetic-to-help-text-only and out of the locked alias scope."
  - "Leave the `envPaths('gsd-config-manager')` app-data literal in packages/server/src/snapshot-store/paths.ts untouched — renaming it would strand existing user data; both command names are intentionally the SAME binary."

patterns-established:
  - "Bin aliasing: a second command name for an existing CLI ships as a one-line `package.json` `bin` addition pointing at the same `./dist/cli.js`, with a packaging-test guard proving both names resolve to the shipped artifact."

requirements-completed: [DIST-01, DIST-03]

coverage:
  - id: D1
    description: "package.json exposes two bin command names (gsd-config-manager and gsd-config-editor), both resolving to ./dist/cli.js"
    requirement: "DIST-03"
    verification:
      - kind: unit
        ref: "node --input-type=commonjs -e deepStrictEqual(package.json.bin, {gsd-config-manager:./dist/cli.js, gsd-config-editor:./dist/cli.js})"
        status: pass
      - kind: unit
        ref: "test/packaging/tarball-contents.test.ts#the gsd-config-editor alias bin also ships and resolves to the same CLI entry"
        status: pass
    human_judgment: false
  - id: D2
    description: "The shipped CLI launches under the shared entry point and reports the loopback port/link it started on"
    requirement: "DIST-01"
    verification:
      - kind: other
        ref: "node dist/cli.js --no-open --port 0 → prints 'Local: http://127.0.0.1:<port>/?t=<uuid>' then clean shutdown"
        status: pass
    human_judgment: false

duration: ~6min
completed: 2026-07-21
status: complete
---

# Quick Task 260721-4vz: gsd-config-editor bin alias command — Summary

**Added `gsd-config-editor` as a second `package.json` bin command mapping to the same shipped `./dist/cli.js` as the existing `gsd-config-manager` — both command names now launch the tool's 127.0.0.1 loopback server, open the browser, and print the port/link banner.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-21
- **Completed:** 2026-07-21
- **Tasks:** 3 (all completed)
- **Files modified:** 2 (package.json, test/packaging/tarball-contents.test.ts)

## Context

The requested behavior — "an npm package with its own command that starts the server and browser and shows the server started on which port/link" — **already existed** in full prior to this task:

- **npm package:** `package.json` already had `name`, `version`, `type: module`, `bin`, `files` (dist/cli.js + dist/client/**), `engines >=20.19`, and `prepublishOnly`. Built artifacts already shipped: `dist/cli.js` (203 KB, `#!/usr/bin/env node` shebang) and `dist/client/` (index.html + assets).
- **Starts server + browser:** `packages/cli/src/bootstrap.ts` already did `app.listen({ port: opts.port ?? 0, host: '127.0.0.1' })` then `open(url)` (guard-wrapped so a headless/WSL browser-open failure prints the manual-open URL instead of crashing).
- **Shows port/link:** `packages/cli/src/output.ts` `banner(url)` already printed the `Local:   http://127.0.0.1:<port>/?t=<token>` line (with the bold+cyan accent reserved exclusively for that URL).

The ONLY delta needed was the **command name**: the user wanted the tool invokable as `gsd-config-editor`. After confirming scope via AskUserQuestion, the locked decision was **add `gsd-config-editor` as an alias bin, keep `gsd-config-manager`, no package rename, no data-dir change** — the lowest-risk path that strands no existing user data and churns no tests.

## Accomplishments
- Added `"gsd-config-editor": "./dist/cli.js"` as a second key in `package.json`'s `bin` object; the existing `gsd-config-manager` entry is byte-unchanged as the first key.
- Added one guard `it` case (`'the gsd-config-editor alias bin also ships and resolves to the same CLI entry'`) to the existing `describe('tarball contents (DIST-03)', ...)` block in `test/packaging/tarball-contents.test.ts`, asserting the alias bin resolves to `./dist/cli.js` AND that file ships — mirrors the existing `gsd-config-manager` assertion. No existing assertion or the slow `extracted-tarball smoke run` describe was touched.
- Verified both that the manifest edit introduced no regression and that the shipped CLI still launches and reports its port/link.

## Verification (all run by orchestrator after executor left SUMMARY.md unwritten)

| Verify | Command | Result |
|--------|---------|--------|
| Task 1 | `node --input-type=commonjs -e deepStrictEqual(package.json.bin, {...})` | `{"gsd-config-manager":"./dist/cli.js","gsd-config-editor":"./dist/cli.js"}` ✓ |
| Task 1 | lockfile diff vs commit parent | clean — `package-lock.json` untouched ✓ |
| Task 2 | `npx vitest run test/packaging/tarball-contents.test.ts -t 'tarball contents '` | **5 passed \| 1 skipped** ✓ (the skip is the slow extracted-tarball smoke run, correctly not selected) |
| Task 3 | `npm run test:ordinary` | **368 passed \| 1 skipped** ✓ (no source/server regression) |
| Task 3 | `timeout 12s node dist/cli.js --no-open --port 0` banner | printed `Local:   http://127.0.0.1:45607/?t=8bc95e59-e4ba-46a6-b1ed-955b44cbe229` then `Server stopped. Port released, no changes lost.` ✓ |

Note: the `STATIC SOURCE EVIDENCE FAILURE: --write-artifact only permits ...` lines printed during the ordinary suite are documented expected stderr from a phase-4 gsd-core source-evidence test (it guards the fixture path), not test failures — the suite reports 368 passed.

## Deviations

- **Executor did not write SUMMARY.md.** The executor committed the code correctly (`cb72e11`) and reported it was creating the SUMMARY on disk, but the file never landed (only PLAN.md was present). The orchestrator independently re-ran all three task verifies against the committed code — all passed — and authored this SUMMARY from the verified results.

## Commit

- Code commit: `cb72e11` — `feat(dist): add gsd-config-editor bin alias command`
  - 2 files changed, 12 insertions(+), 1 deletion(-)
  - `package.json` (+3/-1 `bin` object), `test/packaging/tarball-contents.test.ts` (+10 new guard `it`)
  - Trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Docs commit: see STATE.md "Quick Tasks Completed" commit (this SUMMARY + STATE.md), authored by the orchestrator per the quick workflow Step 8.

## Usage (how a user now launches the tool)

```bash
# After install, both command names work identically:
gsd-config-editor                 # default: OS-assigned free port, opens browser
gsd-config-editor --no-open       # start server, print the Local: http://127.0.0.1:<port>/?t=<token> URL (WSL/headless-friendly)
gsd-config-editor --port 4321     # bind a specific loopback port
gsd-config-manager                # the original command name still works, unchanged
```

The terminal banner reliably tells you the port/link:
```
GSD Config Manager

  ➜  Local:   http://127.0.0.1:<port>/?t=<random-token>
  ➜  Press Ctrl+C to stop
```

On WSL2/headless environments where auto-`open` fails, the tool prints `Open this URL manually to continue: <url>` instead of crashing — keep the `?t=` token (it is the per-session auth token checked on every API request).
