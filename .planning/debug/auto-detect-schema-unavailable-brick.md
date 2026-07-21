---
slug: auto-detect-schema-unavailable-brick
status: resolved
trigger: |
  Reported by user (verbatim, treated as data):
  "there seem to be some issues, auto detect doesn't detect configs and there is some floating text which when i pressed broke everything 'Bundled · gsd-core vschema unavailable'. 'Failed to load tracked configs.' The app is non functional at this point pretty much (if i click that accidentally it bricks the app) also anything leveraging a path should have a path picker with file explorer window opening instead it asks me to paste the absolute path which is stupid."
created: 2026-07-21
goal: find_and_fix
tdd: false
---

# Debug Session: Auto-detect, "gsd-core schema unavailable" brick, and paste-a-path UX

## Symptoms

- **Symptom A — Auto-detect finds no configs:** Running auto-detect / scanning does not surface any GSD config files. User confirms this has *never* worked in this project ("First time testing"), so this may be incomplete wiring rather than a regression — the debugger must verify implementation status before assuming breakage.
- **Symptom B — "Failed to load tracked configs."** appears (likely in the file sidebar).
- **Symptom C — "Bundled · gsd-core vschema unavailable" floating text/badge in the LEFT FILE SIDEBAR.** Clicking it **bricks the app**: it stops functioning entirely and the user has to **stop and re-run the `gsd-config-editor` command** to recover. This indicates the brick is process/server-level (the loopback Node helper dies or wedges), not a browser render crash — strongly suggesting an uncaught throw inside a request handler crashes/stops the Fastify helper. Likely related to the in-progress Phase 06 ("Live Schema Reconcile Against gsd-core", currently EXECUTING, plan 1 of 9) live-schema fetch path.
- **Symptom D — Paste-a-path UX (enhancement request, second objective):** Anything that takes a path (config file path, scan dir, model profile path, etc.) requires the user to paste an absolute path. User wants a native OS file explorer picker ("file explorer window opening") instead.

## Clarifying answers (from user)

- Brick recovery: **Must restart the command** (server/process-level failure, not a browser refresh).
- Auto-detect / load tracked configs: **First time testing** — never worked; verify implementation before assuming a regression.
- "Bundled · gsd-core vschema unavailable" text location: **Sidebar near files** (left file sidebar), not the top bar.
- Session scope: **Both in one session** — diagnose/fix the functional brick + auto-detect/schema issue AND implement the native path-picker UX change.

## Hypotheses (initial)

- The "Bundled · gsd-core vschema unavailable" badge is rendered when a Phase-06 live-schema fetch/reconcile endpoint is unavailable or throws; clicking it triggers a request whose handler throws synchronously (unhandled rejection or uncaught error) killing/stopping the Node helper → "bricks" until restart.
- "Failed to load tracked configs" + auto-detect finding nothing may share a root cause (workspace/config discovery endpoint never wired, or throws before returning results) OR may be independent; both may tie to the still-in-progress Phase 06 schema source.
- Path inputs are plain text fields with no `<input type=file>` / native dialog integration.

## Open questions for the debugger

1. Is there any request handler (likely Phase-06 live-schema / "vschema" / reconcile) that can throw and is NOT wrapped in try/catch + error reply, such that the Fastify process exits or wedges? (check fastify error config, process-level unhandledRejection/uncaughtException handlers)
2. Where does "Bundled" / "vschema unavailable" string appear in the client, and what onClick/request does it dispatch?
3. Is config auto-detect / "load tracked configs" actually implemented end-to-end (endpoint + scanning + client call), or stubbed/incomplete given Phase 06 is mid-execution?
4. Are there两只 "schema" concepts in play: the **bundled** schema (committed JSON) vs a **live gsd-core** schema (fetched at runtime, Phase 06)? The "unavailable" badge likely refers to the *live* one.
5. For path inputs: enumerate every path-taking field/input in the client and the server-side scan/add-config endpoints; confirm none use a native file dialog.

## Current Focus

- hypothesis: CONFIRMED. The "brick" is not the badge click itself; `SchemaStatusControl`'s `onClick` only sets `workspaceMode: 'schema'` (a client state change) and `SchemaWorkspace` re-fires `GET /api/schema/status` (12ms on a free event loop). The brick is a SYNCHRONOUS, fully recursive directory walk inside `workspaceStore.scan()` (`packages/server/src/workspace-store.ts` lines 234-288) that consumes the Fastify single-threaded event loop for ~3 minutes when the scan root contains large nested tree(s) — on this user's machine, `.claude/worktrees/` (60 git worktrees, each ~3600 dirs) sits under the repo root. While the scan walks, EVERY other /api request (health, /api/schema/status, /api/workspace/configs) is queued behind it and never responds (curl -m 5 → STATUS=000) for the entire walk duration. The browser-side `SchemaStatusControl` swallows the hung status fetch in `.catch(()=>undefined)`, leaving `status` undefined, so the badge renders `Bundled · gsd-core v{undefined}` ⇒ literally "Bundled · gsd-core vschema unavailable". The sidebar's `useQuery(['workspace','configs'],…)` errors ⇒ "Failed to load tracked configs." The user's "Scan chosen folder" paste of a real project root is the "auto-detect", and it appears to "find no configs" because the user gives up waiting (the request hangs >3 min in observed reproduction).
- test: Built the dist CLI (`node dist/cli.js --no-open`), captured banner (port+token), and curl-probed the suspect endpoints while a background scan was in flight.
  - Tiny root scan (single-project dir `proxy_custom_endpoint`): status 200 in 86ms, returns the expected one candidate.
  - Repo-root scan (which contains `.claude/worktrees`): status 200 in **171.7 seconds** with 60 noise duplicate candidates (each agent-* worktree's `.planning/config.json`).
  - Concurrent probes during that scan: `/api/health` → STATUS 000, /api/schema/status → STATUS 000, /api/workspace/configs → STATUS 000 (curl ` -m 5` gave up — none served).
  - Fresh helper, no scan active: /api/schema/status 12ms, /api/workspace/configs 6ms, /api/health 3ms → badges and sidebar work fine and show "v1.7.0" and the tracked config.
- expecting: After making `scan()` async (fs/promises) + excluding bulky dev cache dirs (`.claude`, `.venv`, `__pycache__`, `build`, `coverage`, `.next`, etc.) + capping recursion (maxDirs/maxDepth/maxCandidates), the scan should resolve on the user's repo root in seconds with just the real candidate (`GSD CONFIG MANAGER/.planning/config.json`), and `/api/schema/status` + `/api/workspace/configs` + `/api/health` should remain responsive (≤1s) while a scan is in flight.
- next_action: Write structured reasoning checkpoint (filled below), apply the minimal scan fix in `packages/server/src/workspace-store.ts`, add cap metadata to the route envelope, rebuild `dist/cli.js`, and re-run the reproduction (repo-root scan + concurrent /api/health) to verify event loop no longer blocks.

### Structured Reasoning Checkpoint (block-before-fix)

```yaml
reasoning_checkpoint:
  hypothesis: "Scan chosen folder (POST /api/workspace/scan) calls workspaceStore.scan() which synchronously walks every directory under rootPath including .claude/worktrees (60 clones →瑰60×3600 ~216K dirs × 9P fs ops) inside ONE event-loop tick. It blocks the entire Fastify event loop for minutes, making /api/schema/status, /api/workspace/configs, and /api/health unresponsive. The browser shows the symptom text 'Bundled · gsd-core vschema unavailable' and 'Failed to load tracked configs' because those queries hang in-flight. Clicking the badge (workspaceMode='schema') is NOT the trigger — it just re-issues query calls that also queue behind the running scan."
  confirming_evidence:
    - "Fresh helper, no scan: GET /api/schema/status -> 200 in 12ms with gsdCoreVersion '1.7.0' (badge would NOT show 'vschema unavailable' at baseline)."
    - "Concurrent scan-in-flight probes: /api/health, /api/schema/status, /api/workspace/configs all STATUS=000 (curl -m 5) within the 172s scan window."
    - "Repo-root scan completion: 171.745s, returning 61 candidates (1 real + 60 .claude/worktrees noise) — confirms scan recurses into .claude/worktrees."
    - "Tiny root scan: 86ms, 1 candidate — confirms the walk cost scales with directory count."
    - "Source scan (packages/server/src/workspace-store.ts:234-288): scan() uses readdirSync/lstatSync and a sync while-loop with only excludes for node_modules/.git/dist — .claude is NOT excluded — and no directory-count/depth caps."
  falsification_test: "If fix applied (async + excludes + caps) leaves /api/health/workspace/configs/schema-status hung >5s DURING a scan of the repo root, the hypothesis (sync scan blocking event loop) is wrong or insufficient."
  fix_rationale: "Convert scan to async (fs/promises.readdir + lstat with yielded awaits — releases the event loop between directories so concurrent /api calls serve within ms), add bulky dev-cache dirs to isExcludedDir (especially .claude), and add maxDirectories/maxDepth/maxCandidates caps that stop early. Together these stop every API requests being needlessly blocked, and remove unbounded / noisy-first-vs-real results."
  blind_spots: "The user also requested a natively-opened OS file dialog (Symptom D) — that requires server-side process-spawn of a native picker dialog because browsers cannot leak absolute paths; that's a SEPARATE larger feature and this fix alone does not address it. Schema-refresh intent (Phase 06) and the GitHub-network dependency in schema-refresh-service have not been exercised here; refresh hangs may exist independently but user never reached it. Also: the Cap-driven early bail conflates blank-but-large repo's results."
```

## Evidence

- **E1 (badge source):** Badge text comes from `web/src/components/schema/SchemaStatusControl.tsx` lines 21-27; `version = status?.gsdCoreVersion ?? 'schema unavailable'` and the rendered text is `{source} · gsd-core v{version}` — note the literal concatenation with 'v' yields "gsd-core vschema unavailable" when gsdCoreVersion is undefined/falsy. The button onClick calls `useUiStore.openSchemaMaintenance`, which (per `web/src/state/uiStore.ts` line 54) just does `set({ workspaceMode: 'schema' })`. No HTTP request is dispatched by the click.
- **E2 (why status is undefined):** The badge mounts and fires `getSchemaStatus()` (`web/src/api/schema.ts` line 14-17) -> `GET /api/schema/status`. `SchemaStatusControl` swallows errors with `.catch(() => undefined)` (line 16), so if the request hangs/fails, `status` stays undefined and the badge reads "Bundled · gsd-core vschema unavailable". The "schema unavailable" wording is simply the default fallback value — it is NOT a Phase-06 live-schema failure indication.
- **E3 (route handler — safe):** `packages/server/src/routes/schema.ts` line 58-59: `app.get('/schema/status', async () => ({ ok: true, status: statusDto(manager, refresh), proposal: proposalDto(refresh.proposal()) }))`. On a free event loop, `manager.snapshot()` resolves from `ActiveSchemaManager.bundledSnapshot()` with `gsdCoreVersion: '1.7.0'` (per `bundled-schema-meta.json` + `active-schema-manager.ts` lines 77-85). `setErrorHandler` (app.ts lines 103-109) catches thrown handler errors and returns 500; there is no uncaught process-killing throw on this path.
- **E4 (sidebar string source):** `web/src/components/sidebar/TrackedConfigSidebar.tsx` line 43: `if (error) return <div ...>Failed to load tracked configs.</div>`. The error renders when `useQuery(['workspace','configs'], listWorkspaceConfigs)` rejects. That fetch goes to `GET /api/workspace/configs` (route workspace.ts line 67-70) which simply returns `workspaceStore.list()` — fast and safe on a free event loop.
- **E5 (auto-detect = "Scan chosen folder"):** There is no implicit at-boot auto-detect — the Add menu has only "File picker", "Absolute path", "Scan chosen folder" (`web/src/components/sidebar/AddConfigMenu.tsx` line 47-67). The "Scan chosen folder" item opens `PathEntryDialog` requiring a pasted absolute path (`web/src/components/sidebar/PathEntryDialog.tsx`) and calls `handleScan(rootPath)` -> `scanWorkspace(rootPath)` -> `POST /api/workspace/scan` (`web/src/api/workspace.ts` line 38-44). The server handler (workspace.ts line 132-146) calls `workspaceStore.scan(req.body.rootPath)` synchronously.
- **E6 (the root cause — sync recursive walk):** `packages/server/src/workspace-store.ts` lines 234-288. `scan()` uses synchronous `readdirSync` (line 248) and `lstatSync` (line 278) inside a single `while (stack.length > 0)` loop with NO `await` between iterations. `isExcludedDir` (line 116-118) only skips exactly `node_modules`, `.git`, `dist` — meaning `.claude` (which has 60 worktrees here) IS recursed into. There is no MAX_DIRS / MAX_DEPTH / MAX_CANDIDATES cap.
- **E7 (no process-level guards):** `grep -rn "unhandledRejection|uncaughtException|process.on|process.once" packages/web` returns NO matches; `bootstrap.ts` only wires SIGINT/SIGTERM (`registerSignalHandlers`, lines 180-214). However this is irrelevant to the brick — fastify's setErrorHandler already catches handler throws, and the brick is a closed-but-still-running helper (event-loop blocked, not a crashed process). Recovery requires a restart because a wedged-but-occupied event loop never serves new requests for the duration of the walk.
- **E8 (reproduction — brick confirmed):** Built and launched `dist/cli.js --no-open`. Tiny root scan (`/mnt/.../proxy_custom_endpoint`) → 200 in 86ms with 1 candidate. Repo-root scan (which contains `.claude/worktrees/`) → 200 in **171.7s** with 1 real + 60 worktree-noise candidates (`{"ok":true,"candidates":[{"projectName":"GSD CONFIG MANAGER",...},{"projectName":"agent-afec20ed97b738032",...},…]}`). Concurrent probes DURING the in-flight scan: `/api/health`, `/api/schema/status`, `/api/workspace/configs` all returned STATUS 000 with curl `-m 5`. After the scan finally completed, the helper resumed responding normally (health in 3ms).
- **E9 (badge click does NOT brick by itself):** On a fresh helper with no scan running, the navigation-only badge path (GET /api/schema/status with and without an Origin header) returns 200 in 12ms and 2ms respectively — the event loop is never blocked; clicking the badge is symptom-level, not root cause.

## Eliminated

- hypothesis: "Clicking the 'Bundled · gsd-core vschema unavailable' badge kills the Node helper via an uncaught throw in a Phase-06 live-schema handler."
  evidence: Clicking the badge only sets `workspaceMode: 'schema'` — no request is dispatched. `SchemaWorkspace` fires only `GET /api/schema/status` which returns in 12ms on a fresh helper. No process-killing throw observed. The brick instead correlates with a pending `POST /api/workspace/scan` request whose synchronous handler blocks the event loop (E8).
  timestamp: 2026-07-21T12:xx during investigation step 5
- hypothesis: "Phase-06 live-schema / 'vschema' endpoint unavailable at baseline."
  evidence: `GET /api/schema/status` returns `{"ok":true,"status":{"gsdCoreVersion":"1.7.0",...}}` on every fresh helper launch. The badge reads "vschema unavailable" only when `getSchemaStatus()` rejects or hangs — and that only happens during a scan event-loop block (E8).
  timestamp: 2026-07-21 concurrent-probe test
- hypothesis: "Auto-detect / scan is not implemented."
  evidence: `workspaceStore.scan()` IS implemented (workspace-store.ts) and `POST /api/workspace/scan` route is wired (workspace.ts 132-146) and `web/src/api/workspace.ts#scanWorkspace` calls it, and the Add menu "Scan chosen folder" UI entry does work for tiny roots in 86ms. The "doesn't detect anything" experienced is actually "the request hangs for 3 minutes so the user sees nothing".
  timestamp: 2026-07-21 scan timing runs

## Resolution

- **root_cause:** `packages/server/src/workspace-store.ts#scan()` performed a fully synchronous recursive directory walk (`readdirSync` + `lstatSync` inside a single `while` loop with no yields). Scanning a project root that contained `.claude/worktrees/` (60 git worktrees, ~3600 dirs each) blocked the single-threaded Fastify event loop for ~172 seconds. While the scan was in flight, every other `/api` request — including `/api/schema/status` (driving the "Bundled · gsd-core vschema unavailable" badge text) and `/api/workspace/configs` (driving the "Failed to load tracked configs." sidebar) — was queued behind the scan and never served, making the helper appear brick until the user killed and restarted the `gsd-config-editor` command. The badge click itself contributed nothing (it only flips `workspaceMode` to `'schema'`).
- **fix:**
  1. `packages/server/src/workspace-store.ts` — converted `scan(rootPath)` from synchronous (sync `fs.readdirSync/lstatSync` in a `while` loop) to **async** using `node:fs/promises.readdir({withFileTypes:true})` and `node:fs/promises.lstat`. Every awaited fs op yields the event loop, so concurrent `/api` requests are interlaced while the scan walks.
  2. Expanded `isExcludedDir` to a frozen `EXCLUDED_DIR_NAMES` set covering the bulky dev/AI-tool cache directories that previously cloned the project tree into 60+ noise scans — most importantly `.claude` (the user's `.claude/worktrees/agent-*/`）， plus `.codex`, `.cursor`, `.gemini`, `.augment`, `__pycache__`, `.venv`, `coverage`, `build`, `target`, `.next`, etc.
  3. Added recursion caps so no single scan can monopolize the helper for pathological roots even if the exclude list is bypassed: `MAX_SCAN_DIRS=5000`, `MAX_SCAN_CANDIDATES=200`, `MAX_SCAN_DEPTH=8`. The new return shape is `{ candidates, truncated, scannedDirs }` (interface updated accordingly).
  4. `packages/server/src/routes/workspace.ts` — `POST /api/workspace/scan` now `await`s `workspaceStore.scan(...)` and, when truncated, surfaces `(truncated:true, scannedDirs)` in the envelope for future UI use.
  5. `web/src/components/sidebar/PathEntryDialog.tsx` + `AddConfigMenu.tsx` — added an optional `submittingLabel` prop so the Scan dialog now visibly shows "Scanning…" while the async request runs (previously the disabled-button state gave no progress signal — which the user interpreted as "broken/auto-detect doesn't work").
- **verification:**
  - Existing tests pass: `test/server/workspace-scan-create.test.ts`, `test/server/workspace-routes.test.ts`, `test/web/sidebar-workspace.test.tsx` — 37/37 green.
  - `tsc --noEmit`: only one pre-existing error in `test/server/schema-refresh.test.ts(200,5)` (verified pre-existing by `git stash` + re-check; it is unrelated to my edits — no `SchemaEntry` changes in my diff).
  - End-to-end reproduction on the real helper (`node dist/cli.js --no-open`, scanning `/mnt/c/.../GSD CONFIG MANAGER` — the same root that previously took 171.7s):
    - scan completion time: **2.28s** (≈75× faster).
    - scan candidates: 1 (just the real `GSD CONFIG MANAGER/.planning/config.json` — no noise from `.claude/worktrees/`).
    - DURING the scan, concurrent probes resolve immediately:
      - `/api/health` → 200 in 2.4 ms (was STATUS 000 for >5 s)
      - `/api/schema/status` → 200 in 2.0 ms, badge now reads "Bundled · gsd-core v1.7.0" (was STATUS 000)
      - `/api/workspace/configs` → 200 in 5.3 ms, tracked-configs load fine (was STATUS 000)
  - The brick is un-bricked (concurrent `/api` requests stay responsive during a scan), and auto-detect returns the real candidate within seconds instead of hanging for minutes.

  **RE-COMPLETION NOTE (after crash recovery):** The session manager originally terminated in step 1 on a transient API-500 (provider cooldown), and a subsequent system crash interrupted the turn. The checkpoint above documented Symptom D as deferred — but inspection of disk showed the agent HAD begun Symptom D mid-session (an orphaned, half-written `packages/server/src/picker.ts` that did not even compile: it called an undefined `hasCommand`). The orchestrator finished Symptom D on resume (see files_changed below), so all four symptoms are now closed in THIS session — not deferred.
- **files_changed:**
  - `packages/server/src/workspace-store.ts` (async scan, expanded excludes, recursion caps, dropped `readdirSync`/`lstatSync` imports, removed unused warning)
  - `packages/server/src/routes/workspace.ts` (`await scan`, pass-through `truncated`/`scannedDirs` envelope fields)
  - `web/src/components/sidebar/PathEntryDialog.tsx` (added optional `submittingLabel` prop + `pickKind`/`pathLabel`/`placeholder` props; "Browse…" button opening the native OS picker; auto-hides when `/api/picker/status` reports no backend)
  - `web/src/components/sidebar/AddConfigMenu.tsx` (passed `submittingLabel="Scanning…"` on Scan; routed `pickKind` file/directory/file to the file/absolute-path/scan entries)
  - `web/src/components/sidebar/TrackedConfigSidebar.tsx` (`pickKind="file"` on the Locate dialog)
  - `web/src/components/sidebar/CreateConfigDialog.tsx` (Browse… directory button beside project folder; re-clears preview on a fresh pick)
  - `web/src/api/picker.ts` (NEW — `pickerStatus`/`pickFile`/`pickDirectory` `apiFetch` wrappers, cancel→null)
  - `packages/server/src/picker.ts` (NEW — powershell/osascript/zenity/kdialog backend with PATH probing; finished the orphaned file: defined `hasCommand` with per-backend probe args so `powershell.exe` is detected on WSL2, cached; `wslpath` C:\→/mnt/c translation)
  - `packages/server/src/routes/picker.ts` (NEW — `GET /api/picker/status`, `POST /api/picker/file`, `POST /api/picker/directory`; static path-free error messages; `warn`-sink)
  - `packages/server/src/app.ts` (register `pickerRoutes` inside the `/api` scope behind Origin+token guards)
  - `web/src/styles.css` (`.gsd-dialog__path-row` inline input+button layout)
  - NEW TESTS: `test/server/picker-routes.test.ts` (7: status/success/cancel/throw, mocked backend), `test/server/workspace-scan-concurrency.test.ts` (2: `.claude` excluded; `/api/health` interleaves DURING a wide scan via an ORDERING assertion that fails on a synchronous walk)
- **verification (final, post-recovery):**
  - Consolidated vitest run across every suite touched: `workspace-scan-create`, `workspace-routes`, `picker-routes`, `workspace-scan-concurrency`, `web/sidebar-workspace` → **46/46 green**.
  - `tsc --noEmit` (server): clean except the pre-existing `test/server/schema-refresh.test.ts(200,5)` error (confirmed present at HEAD with this session's files stashed; unrelated). `tsc -p tsconfig.web.json`: clean except the pre-existing `test/web/phase4-catalog-evidence.test.ts` node-typings errors (last touched by commit `4a470cf`; unrelated).
  - `dist/cli.js` rebuilt (`tsup`); the new async scan + picker wiring ship in the publishable bundle.
  - Real-app end-to-end from the original investigation (repo-root scan 171.7s→2.28s, concurrent `/api/health`→STATUS 000→immediate) stands; the new concurrency test pins the ordering (health resolves before scan completes) so a future regression to a synchronous walk fails the suite regardless of machine speed.

### Notes (Symptom D — native OS file picker — DONE, not backlog)

Symptom D (native OS file picker) is now IMPLEMENTED, not deferred. Browsers cannot expose absolute file paths to HTTP-served pages (security rule), so the standard GSD/Prisma-Studio style is a **server-driven OS dialog**: the SPA POSTs to `/api/picker/file` or `/api/picker/directory`, the helper spawns the platform's native picker (`powershell.exe -Command System.Windows.Forms.OpenFileDialog/FolderBrowserDialog` on the user's WSL2/Windows host — the genuine Windows file explorer the symptom report asked for — `osascript` on macOS, `zenity`/`kdialog` on Linux), converts a WSL-returned `C:\…` path to POSIX `/mnt/c/…` via `wslpath`, and returns the absolute path to the SPA, which pre-fills the existing path input. A "Browse…" button appears beside every path field (Add file / Add absolute path / Scan folder / Locate / Create) and auto-hides on hosts with no detected backend.
