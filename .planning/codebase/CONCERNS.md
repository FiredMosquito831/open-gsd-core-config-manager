# Codebase Concerns

**Analysis Date:** 2026-07-31

## Tech Debt

### Minified single-line JSX in SchemaWorkspace

- Issue: `web/src/components/schema/SchemaWorkspace.tsx` is 36 lines, but the entire `SchemaWorkspace` render and the `ResetDialog` JSX are written as a handful of multi-thousand-character single-line expressions. This is effectively minified production code checked into source.
- Files: `web/src/components/schema/SchemaWorkspace.tsx`
- Impact: Near-impossible to diff, review, or maintain; a single-line change produces a full-line diff; the file violates the readable-code convention the rest of the `web/src/components/` tree follows (compare `web/src/components/history/HistoryWorkspace.tsx`). Sets a precedent that dense code is acceptable in the schema maintenance UI.
- Fix approach: Re-format the JSX into normal multi-line element structure. The component is functionally covered by `test/web/schema-workspace.test.tsx`, so a formatting-only refactor is low-risk and should be done before any future schema-maintenance feature work.

### Dead/orphaned ConfigEditor component

- Issue: `web/src/components/ConfigEditor.tsx` is an early stub editor component that nothing imports. `web/src/App.tsx` imports `ConfigEditor` from `./components/editor/ConfigEditor` (the real one at `web/src/components/editor/ConfigEditor.tsx`).
- Files: `web/src/components/ConfigEditor.tsx` (dead), `web/src/components/editor/ConfigEditor.tsx` (live)
- Impact: Confusing duplicate-name discovery; dead code ships conceptual clutter and can mislead future contributors into editing the wrong file.
- Fix approach: Delete `web/src/components/ConfigEditor.tsx`.

### `require`-shim / dynamic-import chain in the CLI

- Issue: A three-file fragile chain exists purely to work around an Ajv CJS-interop typecheck gap. `packages/config-io/src/validate.ts` uses TypeScript's `import ajv2020Module = require(...)` form; `packages/cli/src/cli.ts` shims `globalThis.require` and then loads the real logic via a dynamic `import('./cli-main.js')` so `validate.ts`'s module body only evaluates after the shim exists.
- Files: `packages/cli/src/cli.ts`, `packages/cli/src/cli-main.ts`, `packages/config-io/src/validate.ts`
- Impact: Any change to Ajv's package exports (or to `validate.ts`'s import form) can break the packaged CLI in a way that typecheck/tests from source may not catch. The `import = require` form is also non-idiomatic and forces the whole shim architecture. This is a documented, deliberate workaround (`tsup.config.ts` header, `validate.ts` header), but it is load-bearing and brittle.
- Fix approach: Monitor `typescript-eslint`/`tsup`/Ajv support; if a future Ajv release ships proper ESM exports, remove both the `import = require` form and the CLI shim. Do not touch without the extracted-tarball smoke test (`test/packaging/tarball-contents.test.ts`) green.

### Latent packaged-bundle schema-path landmine in `load.ts`

- Issue: `packages/config-io/src/load.ts` resolves its default schema via `path.resolve(MODULE_DIR, '..', '..', 'schema-data', 'bundled-schema.json')`. In the published `dist/cli.js`, `MODULE_DIR` is `dist/`, so this walks to a path that does not exist in the npm tarball (package.json `files` ships only `dist/cli.js` + `dist/client/**`). Any caller that relies on `load()`'s default schema (instead of injecting `schema` via `LoadOptions`) crashes with ENOENT in the packaged artifact.
- Files: `packages/config-io/src/load.ts` (`DEFAULT_SCHEMA_PATH`, `loadSchema`), `packages/server/src/schema.ts` (documents the landmine and works around it), `package.json` (`files`)
- Impact: Currently safe — `packages/server/src/routes/configs.ts` always calls `load(path, { schema: snapshot.schema })` and `packages/server/src/schema.ts` imports the JSON as a module so tsup inlines it. But `load.ts` remains a footgun for any future direct caller (e.g., a new CLI command or a config-io consumer).
- Fix approach: Either bundle a copy of the schema JSON into `dist/` and adjust the shipped path, or make `load.ts` accept the schema from an inline module import. Keep the tarball smoke test as the guard.

### Redundant manual enum validation on the client

- Issue: `web/src/schema/validation.ts` builds an Ajv schema (which already enforces `enum` via `buildAjvSchema`) and *additionally* maintains a `enumByPath` map and walks every enum path on every validation call. The manual walk is O(keys) per validation and is redundant with Ajv's own enum checking.
- Files: `web/src/schema/validation.ts`
- Impact: Duplicated validation logic that can drift from the schema; minor per-keystroke CPU cost on large configs. The server-side equivalent (`packages/config-io/src/validate.ts`) does not do this.
- Fix approach: Verify Ajv's compiled schema already reports enum failures and drop the manual `enumByPath` walk (or keep it only if it produces materially better error messages that `test/web/client-validation.test.ts` depends on).

### Test-only method in production schema persistence

- Issue: `packages/server/src/schema-persistence.ts` exposes `writeRawForTest()` in the production `SchemaOverrideStore` class (synchronous `writeFileSync` + `renameSync` used only by persistence fixtures).
- Files: `packages/server/src/schema-persistence.ts`
- Impact: Test seam leaks into production API surface; minor.
- Fix approach: Move to a test-only injection seam, or accept as-is since it is small and clearly named.

## Known Bugs

### Unbounded snapshot-history growth (no pruning or dedup)

- Issue: Every successful save records a full-JSON snapshot (`packages/server/src/snapshot-store/index.ts#recordSnapshot`) with no retention policy. `index.ts` header explicitly defers keep-last-N / skip-identical dedup ("D-09 ... can be added later WITHOUT an on-disk format migration"), but nothing has implemented it yet. Repeated saves of near-identical configs accumulate full copies in the OS app-data directory forever.
- Files: `packages/server/src/snapshot-store/index.ts`, `packages/server/src/snapshot-store/save-with-snapshot.ts`
- Impact: Long-lived tool with frequent saves grows app-data without bound; the web history UI already needs progressive loading (`web/src/history/useProgressiveHistoryCounts.ts`) as a symptom.
- Fix approach: Implement skip-identical-save dedup (the `contentHash` field already exists on every index entry) plus a keep-last-N cap with milestone retention. The on-disk format already supports both without migration.

### History can silently gap when snapshot recording fails (D-12)

- Issue: In `packages/server/src/snapshot-store/save-with-snapshot.ts`, a `recordSnapshot` failure is swallowed into a warning — the save succeeds but no version-history entry is written. The warning is surfaced on the API response but is easy to miss in the UI.
- Files: `packages/server/src/snapshot-store/save-with-snapshot.ts` (step 3/4)
- Impact: A user relying on history to revert could find a specific save absent from the timeline with only a transient warning explaining why.
- Fix approach: Keep the non-fatal contract (a failed history write must never lose a save), but consider surfacing the warning more prominently in the History workspace UI, and retry the snapshot write once.

### Schema refresh proposal expires silently after 5 minutes

- Issue: A schema refresh proposal carries `expiresAt = now + 5 min` (`packages/server/src/schema-refresh-service.ts#run`), and `proposal()` drops an expired proposal. If the user reviews the Schema maintenance screen for more than 5 minutes before clicking "Activate schema", the activate request 404s ("Schema proposal is unavailable.").
- Files: `packages/server/src/schema-refresh-service.ts`, `web/src/components/schema/SchemaWorkspace.tsx`
- Impact: Mid-review schema updates can become un-activatable without an obvious cause; the UI shows a generic failure message.
- Fix approach: Either extend the expiry, refresh the expiry on user interaction, or have the UI detect a 404 on activate and offer to re-check for updates.

### Live gsd-core refresh path is not exercised in CI

- Issue: `test/server/schema-refresh-live.test.ts` is `describe.skipIf(!LIVE_COMPATIBILITY)` — the real GitHub network path (release lookup, archive fetch, tar inspection, registry parse) is skipped unless a `LIVE_COMPATIBILITY` env var is set. The non-live `test/server/schema-refresh.test.ts` mocks the fetch layer, so the production `defaultRefreshDependencies` network code is only exercised on demand.
- Files: `test/server/schema-refresh-live.test.ts`, `packages/server/src/schema-refresh-service.ts`
- Impact: Changes to the fetch/archive-inspection pipeline can pass CI while the real GitHub round-trip is broken (rate-limit handling, response-shape drift, tar-format changes).
- Fix approach: Add a scheduled/live CI job that sets `LIVE_COMPATIBILITY` and runs the live suite against the real upstream.

## Security Considerations

### Launch token in the URL query string

- Risk: The per-launch token is delivered as `?t=<uuid>` in the auto-opened URL (`packages/cli/src/bootstrap.ts`) and printed in the launch banner. The SPA strips it from the URL immediately via `history.replaceState` (`web/src/bootstrap/token.ts`) and retains it only in memory, which is good — but the token still appears transiently in browser history, process command lines, terminal scrollback, and any URL-capturing tool.
- Files: `packages/cli/src/bootstrap.ts`, `packages/server/src/context.ts`, `web/src/bootstrap/token.ts`
- Current mitigation: Loopback-only bind (`127.0.0.1`), Host allowlist, exact-match CORS + Origin guard, `timingSafeEqual` token guard, no token logging. `replaceState` clears the URL.
- Recommendations: Document the token-in-URL tradeoff; consider a fragment-based token (`/#t=...`) which is not sent to the server and is excluded from most history/screenshot tools, or a short-lived token with a second exchange.

### Picker subprocess spawning is a dialogs-on-demand surface

- Risk: `packages/server/src/picker.ts` spawns `powershell.exe`, `osascript`, `zenity`, or `kdialog` on demand. The PowerShell scripts are constants (no user input interpolated → no command injection), and the endpoint is behind the token/Origin guards, but a compromised page that obtains the token (or a local process on the loopback) could trigger repeated OS dialogs.
- Files: `packages/server/src/picker.ts`, `packages/server/src/routes/picker.ts`
- Current mitigation: Fixed script constants; guarded `/api/picker/*` routes; backend probing never blocks the event loop.
- Recommendations: Add a rate limit to picker endpoints and require the picker to be invoked only in response to an explicit user gesture in the UI.

### No secrets stored in the repo — verify on every release

- Risk: No `.env` files or credentials exist in the tree (verified), and the error handlers deliberately never log config contents (e.g. `packages/config-io/src/validate.ts#formatErrors`, `packages/config-io/src/atomic-write.ts#ValidationError`). Secret-shaped config values are masked in the UI via `web/src/components/specialized/SecretField.tsx`.
- Files: `packages/config-io/src/validate.ts`, `packages/server/src/app.ts` (error handler), `web/src/components/specialized/SecretField.tsx`
- Current mitigation: Path-only error messages; `x-*` redaction; `SecretField` auto-remasks after 15s.
- Recommendations: Keep the `npm pack --dry-run` / tarball-content test gate (`test/packaging/tarball-contents.test.ts`) mandatory before release so a stray credential file can never ship.

## Performance Bottlenecks

### Synchronous file I/O on the config read path

- Problem: `packages/config-io/src/load.ts` uses `fs.readFileSync` for the project config, global defaults, and schema on every GET `/api/configs/:id`.
- Files: `packages/config-io/src/load.ts`, `packages/config-io/src/discovery.ts`
- Cause: Sync reads block the Fastify event loop; acceptable for a single-user local tool but adds latency to every editor load and to the concurrent re-load after each save.
- Improvement path: Convert the hot read path to `fs/promises` (the scan path in `workspace-store.ts` already proves the async pattern). Low priority for a loopback single-user tool.

### Regex-pattern key classification is O(leaves × patterns)

- Problem: `packages/config-io/src/known-keys.ts#isKnownKey` tests every unknown leaf against every compiled `patternProperties` regex. `collectUnknownPaths` in `load.ts` calls it for each leaf in project + global layers.
- Files: `packages/config-io/src/known-keys.ts`, `packages/config-io/src/load.ts`
- Cause: Linear scan of patterns per leaf. With ~158 schema keys and a handful of dynamic-map patterns this is trivial today; it only matters for very large foreign subtrees.
- Improvement path: Bucket patterns by top-level segment so only patterns whose container matches the leaf's prefix are tested.

### Workspace scan truncates large trees by design

- Problem: `packages/server/src/workspace-store.ts#scan` hard-caps at `MAX_SCAN_DIRS = 5_000`, `MAX_SCAN_CANDIDATES = 200`, `MAX_SCAN_DEPTH = 8`, and skips an extensive `EXCLUDED_DIR_NAMES` list.
- Files: `packages/server/src/workspace-store.ts`
- Cause: Deliberate guard against the past "sidebar brick" event-loop starvation (documented in the file header).
- Impact: A monorepo or deep workspace root silently returns partial results with only a `truncated: true` flag; users may conclude auto-detect "found nothing".
- Improvement path: Surface the truncation state in the scan-review UI (`web/src/components/sidebar/ScanReviewDialog.tsx`) with an explicit "showing first N matches" notice, and consider raising caps behind an async/progress-reporting walk.

## Fragile Areas

### Write-path depends on an unmaintained advisory-lock library

- Component: `proper-lockfile@4.1.2` is used in every core write path: `packages/config-io/src/atomic-write.ts#saveConfig`, `packages/server/src/workspace-store.ts#withWorkspaceLock`, `packages/server/src/snapshot-store/index.ts#withIndexLock`, and `packages/server/src/snapshot-store/save-with-snapshot.ts#withTransactionLock`.
- Files: `packages/config-io/src/atomic-write.ts`, `packages/server/src/workspace-store.ts`, `packages/server/src/snapshot-store/index.ts`, `packages/server/src/snapshot-store/save-with-snapshot.ts`
- Why fragile: Last published 2021 (no recent maintenance, per CLAUDE.md). A Node-version incompatibility or CVE affecting it would touch the entire data-safety pipeline. Its `realpath: true` default (requires the target file to exist) is why `save-with-snapshot.ts` has to pre-touch stub files for brand-new configs — itself a fragile workaround.
- Safe modification: Wrap it behind the existing lock helpers and keep the fault-injection seams (`SnapshotWriteDeps`, `SaveDeps`, `WorkspaceStoreOptions.write`); tests in `test/server/snapshot-store.test.ts`, `test/config-io/atomic-write.test.ts`, and `test/server/teardown.test.ts` guard the behavior.
- Test coverage: Lock-acquisition/teardown and stale-lock release are exercised; crash-consistency is covered by fault injection.

### Mutable `LaunchContext` read at request time

- Component: The four guard plugins (`host-guard`, `origin-guard`, `token-guard`, `cors`) close over a mutable `LaunchContext` and read `allowedHosts`/`corsOrigin` at request time, not registration time. `sealLaunchContext` must run exactly once after `listen()`.
- Files: `packages/server/src/context.ts`, `packages/server/src/plugins/*.ts`, `packages/server/src/app.ts`
- Why fragile: The whole security model depends on registration order (host guard at root before static; token/origin guards inside `/api` only) and on sealing before any request. Any reordering in `app.ts` can silently weaken or break a guard. The fail-closed default (empty hosts, `null` origin) mitigates misordering but not "sealed with the wrong port".
- Safe modification: Preserve the documented registration order in `app.ts`; add an explicit `sealed` assertion so a second `sealLaunchContext` call or a request before sealing throws loudly.

### CLI entry shim ordering

- Component: `packages/cli/src/cli.ts` must shim `globalThis.require` before any module in the `validate.ts` import graph evaluates, and must use a dynamic `import()` (no top-level await).
- Files: `packages/cli/src/cli.ts`, `packages/cli/src/cli-main.ts`
- Why fragile: If anyone "simplifies" the dynamic import back to a static one, or hoists an import above the shim, the packaged CLI breaks with `require is not defined` — a failure that only manifests in the bundled artifact, not from-source tests.
- Safe modification: Only refactor together with `packages/config-io/src/validate.ts` and only with the extracted-tarball smoke test (`test/packaging/tarball-contents.test.ts`) passing.

### Single path-validation boundary

- Component: `packages/server/src/registry.ts#track()` is the ONLY place a client-supplied filesystem path is accepted. Every other route resolves an opaque id through `resolve(id)`.
- Files: `packages/server/src/registry.ts`, `packages/server/src/routes/configs.ts`, `packages/server/src/routes/workspace.ts`
- Why fragile: The security posture assumes no new route will ever accept a raw path without routing it through `track()`/`relocate()`. A future route that inlines its own path handling would bypass traversal, `.json`-suffix, and regular-file checks.
- Safe modification: When adding any new path-taking route, delegate to the workspace store/registry and add a security regression test in `test/server/security.test.ts`.

## Scaling Limits

### App-data snapshot directory grows without bound

- Current capacity: One full JSON file per save per tracked config, retained indefinitely under the OS app-data directory (`packages/server/src/snapshot-store/paths.ts#snapshotDirFor`).
- Limit: Disk usage grows linearly with number of saves; a config saved 1,000 times occupies ~1,000 × config size. No cap, no milestone pruning, no dedup.
- Scaling path: Add content-hash skip-identical dedup first (the `contentHash` field is already written), then keep-last-N + milestone retention, then optional compression.

### Single-file workspace metadata

- Current capacity: All tracked-config ids/paths live in one `configs.json` under app-data (`packages/server/src/workspace-store.ts#configFilePath`), rewritten in full on every add/remove/reorder/locate/create.
- Limit: A workspace tracking thousands of configs rewrites the whole array per mutation; the file-lock + atomic-write serializes all workspace mutations.
- Scaling path: Acceptable for the target user (a handful of projects); if it grows, shard per-project or use a line-oriented log. Low priority.

## Dependencies at Risk

| Package | Version | Risk | Impact | Mitigation |
|---------|---------|------|--------|-----------|
| `proper-lockfile` | 4.1.2 | Unmaintained since 2021; no recent commits | Core write-path locking (config saves, snapshot index, workspace metadata) | Wrap behind lock helpers; keep fault-injection seams; re-evaluate on any Node/CVE signal |
| `write-file-atomic` | 7.0.1 (pinned below `^8`) | Pinned deliberately; GitHub issue #227 (no Windows rename retry) | Windows transient EPERM/EBUSY/EACCES on rename | Local retry wrapper in `packages/config-io/src/atomic-write.ts#writeWithRetry`; do not float to 8 until Node floor rises |
| `ajv` / `ajv-formats` | 8.20.0 / 3.0.1 | CJS interop gap forces `import = require` and the CLI `require` shim | Bundling fragility on the CLI path | Monitor for proper ESM exports; guarded by tarball smoke test |
| `typescript` | 5.9.3 (pinned, NOT 7.x/tsgo) | Deliberate pin; 7.x has no stable programmatic API yet | None today; revisit once tsup/vite/typescript-eslint confirm 7.x support | Documented in CLAUDE.md |

## Missing Critical Features

### Snapshot retention / dedup policy

- Problem: No keep-last-N pruning, milestone retention, or skip-identical-save dedup, despite the D-09 format supporting them.
- Blocks: Long-term safe use of version history; unbounded app-data growth (see Scaling Limits).

### E2E browser test coverage

- Problem: The recommended stack lists Playwright for end-to-end tests, but `package.json` has no Playwright dependency and there is no E2E suite. Round-trip flows (save → disk → reload → revert) are covered by integration tests (`test/server/cli-launch.test.ts`, `test/packaging/tarball-contents.test.ts`) and React component tests, but no test drives the real browser UI against the real loopback server.
- Blocks: Confidence in cross-platform UI behavior (esp. WSL/Windows path translation and the picker).

### CI pipeline

- Problem: No `.github/workflows/` or other CI configuration exists. `npm test`, `npm run typecheck`, and the packaging/extracted-tarball tests must be run manually.
- Blocks: Regression protection on merge; the live schema-refresh suite (see Known Bugs) has no scheduled home.

## Test Coverage Gaps

### Live gsd-core network round-trip

- What's not tested: The production `defaultRefreshDependencies` network path in `packages/server/src/schema-refresh-service.ts` (GitHub release lookup, archive fetch, tar inspection) under real conditions.
- Files: `test/server/schema-refresh-live.test.ts` (skipped unless `LIVE_COMPATIBILITY` is set)
- Risk: GitHub API response-shape or rate-limit changes break schema refresh silently.
- Priority: Medium

### Path-picker OS backends

- What's not tested: The actual `powershell.exe` / `osascript` / `zenity` / `kdialog` dialog invocation in `packages/server/src/picker.ts` (backend probing is logic-tested, but real dialog launch is not).
- Files: `test/server/picker-routes.test.ts`
- Risk: A platform-specific dialog regression ships unnoticed.
- Priority: Low

### SchemaWorkspace edge states

- What's not tested: The dense `SchemaWorkspace.tsx` component's failure branches (`failure === 'activate' | 'cancel' | 'reset'`) and the Recovery/Reset flow; `test/web/schema-workspace.test.tsx` covers the main paths.
- Files: `web/src/components/schema/SchemaWorkspace.tsx`, `test/web/schema-workspace.test.tsx`
- Risk: The component is the hardest to read in the codebase and the least-exercised error states live in its densest section.
- Priority: Medium

### Dead/legacy code

- What's not tested: `web/src/components/ConfigEditor.tsx` has no test — it is dead code (see Tech Debt). Its existence can mask what "the editor" actually is.
- Files: `web/src/components/ConfigEditor.tsx`
- Risk: Low (unused), but it should be deleted rather than tested.
- Priority: Low

---

*Concerns audit: 2026-07-31*
