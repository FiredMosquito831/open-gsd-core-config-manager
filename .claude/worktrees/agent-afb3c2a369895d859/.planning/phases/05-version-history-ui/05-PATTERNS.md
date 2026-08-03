# Phase 5: Version History UI - Pattern Map

**Mapped:** 2026-07-19  
**Files analyzed:** 19 planned new/modified implementation and test files  
**Analogs found:** 18 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `package.json` | config | batch | `package.json` | exact |
| `package-lock.json` | config | batch | no committed lockfile | no analog |
| `packages/server/src/snapshot-store/index.ts` | service | file-I/O | same file `recordSnapshot`/`readIndex` | exact |
| `packages/server/src/api-types.ts` | model | transform | same file `ApiOk`/`ApiErr` | exact |
| `packages/server/src/routes/history.ts` | route | request-response | `packages/server/src/routes/configs.ts` | role-match |
| `packages/server/src/app.ts` | config | request-response | same file API plugin registration | exact |
| `web/src/api/configs.ts` | service | request-response | same file config wrappers | exact |
| `web/src/state/uiStore.ts` | store | event-driven | same file focused-workspace state | exact |
| `web/src/App.tsx` | component | event-driven | same file app composition | exact |
| `web/src/components/AppShell.tsx` | component | event-driven | same file three-pane shell | exact |
| `web/src/components/editor/ConfigEditor.tsx` | component/hook seam | request-response | same file query/mutation draft lifecycle | exact |
| `web/src/components/history/HistoryWorkspace.tsx` | component | request-response | `web/src/components/specialized/FocusedWorkspace.tsx` | data-flow match |
| `web/src/components/history/SnapshotTimeline.tsx` | component | transform | `web/src/components/specialized/PoolEntryList.tsx` / `FocusedWorkspace.tsx` | role-match |
| `web/src/components/history/SnapshotDiff.tsx` | component | transform | `web/src/components/unknown/SafeValuePreview.tsx` and `SecretField.tsx` | partial |
| `web/src/components/history/HistoryDiffTree.tsx` | component | transform | no structural-diff tree exists | no analog |
| `web/src/components/history/RestoreDialogs.tsx` | component | event-driven | `web/src/components/specialized/FocusedWorkspace.tsx` | role-match |
| `web/src/styles.css` | config | transform | existing `gsd-*` component-class sections | role-match |
| `test/server/snapshot-store.test.ts` | test | file-I/O | same file | exact |
| `test/server/history-routes.test.ts` | test | request-response | `test/server/api-routes.test.ts` + `snapshot-store.test.ts` | role/data-flow match |
| `test/web/history-workspace.test.tsx` | test | request-response/event-driven | `test/web/sidebar-workspace.test.tsx` | role/data-flow match |

> The planned component split is from research. If implementation keeps `HistoryDiffTree` inside `SnapshotDiff.tsx`, retain the assignments below; it has no existing direct analog because this project has no structural-diff renderer.

## Pattern Assignments

### `packages/server/src/snapshot-store/index.ts` (service, file-I/O)

**Analog:** existing snapshot index/list implementation in the same file.

**Imports and derived-directory pattern** (lines 28-31, 57-74, 121-125):
```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { snapshotDirFor } from './paths.js';

export async function readIndex(dir: string): Promise<SnapshotIndex> {
  let raw: string;
  try {
    raw = await readFile(join(dir, 'index.json'), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { entries: [] };
    throw err;
  }
  try {
    const parsed = JSON.parse(raw) as SnapshotIndex;
    return { entries: parsed.entries };
  } catch {
    throw new Error(`Failed to parse snapshot index at path: ${join(dir, 'index.json')}`);
  }
}

export async function listSnapshots(configPath: string, root?: string) {
  const dir = snapshotDirFor(configPath, root);
  const index = await readIndex(dir);
  return index.entries;
}
```

**Core safe-read assignment:** add a read-by-**numeric sequence** helper beside `listSnapshots`. It must derive `dir` from server-resolved `configPath`, find an exact `entry.seq`, require `entry.file === `${seq}.json``, then `readFile(join(dir, canonicalFile))` and `JSON.parse`. Do not accept a browser filename/path, and do not use `entry.file` for a path until canonical equality has passed. Keep parse failures content-free.

---

### `packages/server/src/routes/history.ts` and `packages/server/src/app.ts` (route/config, request-response)

**Analog:** `packages/server/src/routes/configs.ts`.

**Route imports, options, opaque-ID authorization, and frozen error envelope** (lines 20-35, 49-50, 70-93):
```ts
import type { FastifyPluginAsync } from 'fastify';
import { load } from '../../../config-io/src/index.js';
import { getBundledSchema, getValidator } from '../schema.js';
import { saveWithSnapshot } from '../snapshot-store/save-with-snapshot.js';
import { RegistryError, isRegularFileOrMissing, type ConfigRegistry } from '../registry.js';
import type { ApiErr } from '../api-types.js';

export interface ConfigRoutesOptions {
  registry: ConfigRegistry;
  snapshotRoot?: string;
  warn?: (message: string) => void;
}
function errBody(message: string): ApiErr {
  return { ok: false, errors: [{ message }] };
}

const tracked = registry.resolve(req.params.id);
if (!tracked) return reply.code(404).send(errBody('Unknown tracked config id'));
if (!isRegularFileOrMissing(tracked.path)) {
  return reply.code(404).send(errBody('Unknown tracked config id'));
}
```

**Safe write/revert pattern** (lines 95-122):
```ts
app.put<{ Params: { id: string }; Body: { config: object } }>(
  '/configs/:id',
  { schema: { body: SAVE_BODY_SCHEMA } },
  async (req, reply) => {
    const tracked = registry.resolve(req.params.id);
    if (!tracked) return reply.code(404).send(errBody('Unknown tracked config id'));
    if (!isRegularFileOrMissing(tracked.path)) {
      return reply.code(404).send(errBody('Unknown tracked config id'));
    }
    const result = await saveWithSnapshot(tracked.path, req.body.config, getValidator(), {
      root: snapshotRoot, warn,
    });
    if (!result.ok) return reply.code(422).send({ ok: false, errors: result.errors });
    return { ok: true, snapshotId: result.snapshotId, warning: result.warning };
  },
);
```

**Registration/security pattern** (`packages/server/src/app.ts` lines 99-111):
```ts
await app.register(
  async (api) => {
    await api.register(fastifyCors, buildCorsOptions(opts.ctx));
    registerOriginGuard(api, opts.ctx);
    registerTokenGuard(api, opts.ctx);
    await api.register(configRoutes, { registry, snapshotRoot: opts.snapshotRoot, warn: opts.warn });
  },
  { prefix: '/api' },
);
```

**Assignment:** register the additive history plugin inside this existing `/api` scope, passing the same `registry`, `snapshotRoot`, and `warn`. List/detail/restore paths must use only opaque `id` plus an integer sequence schema. Load current persisted project JSON server-side for comparison; restore only after trusted snapshot parse through `saveWithSnapshot()`. Let unexpected filesystem/parse errors reach `app.ts`'s existing static `Internal error` handler (lines 76-91), never return path or content.

---

### `packages/server/src/api-types.ts` and `web/src/api/configs.ts` (model/service, transform/request-response)

**Analogs:** same files.

**Frozen envelope extension pattern** (`packages/server/src/api-types.ts` lines 11-18):
```ts
export type ApiOk<T = Record<string, never>> = { ok: true } & T;
export interface ApiErr {
  ok: false;
  errors: Array<{ message: string; [k: string]: unknown }>;
}
```

**Thin token-aware wrapper pattern** (`web/src/api/configs.ts` lines 4-25):
```ts
export function loadConfig(id: string) {
  return apiFetch<{ data: LoadResult }>(`/api/configs/${id}`).then((r) => r.data);
}
export function saveConfig(id: string, config: object) {
  return apiFetch<{ snapshotId?: string; warning?: string }>(`/api/configs/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config }),
  });
}
```

**Assignment:** add additive history metadata/detail/restore types and wrappers here. Each client wrapper calls `apiFetch`, returns the payload field (not the `{ ok: true }` envelope), uses the opaque ID and numeric sequence only, and sends JSON only for restore. Do not create another fetch client.

---

### `web/src/state/uiStore.ts`, `web/src/App.tsx`, and `web/src/components/AppShell.tsx` (store/components, event-driven)

**Analogs:** existing focused-workspace state, root composition, and pane shell.

**UI state/reset-on-config-switch pattern** (`uiStore.ts` lines 27-49):
```ts
setActiveConfigId: (activeConfigId) => set({
  activeConfigId,
  focusedPath: null,
  focusedOriginChapter: null,
  profileEditorOpen: false,
  profileSessionLabel: '',
}),
setFocusedPath: (focusedPath, focusedOriginChapter) => set({ focusedPath, focusedOriginChapter }),
```

**App composition pattern** (`App.tsx` lines 18-37):
```tsx
<AppShell
  leftOpen={leftPaneOpen}
  middleOpen={middlePaneOpen}
  onToggleLeft={toggleLeftPane}
  onToggleMiddle={toggleMiddlePane}
  searchQuery={searchQuery}
  onSearchQueryChange={setSearchQuery}
  sidebar={<TrackedConfigSidebar />}
  chapterNav={<ChapterNav />}
  editor={connected ? <ConfigEditor /> : <div className="gsd-connection-warning" role="alert">...</div>}
/>
```

**Shell accessibility/pane pattern** (`AppShell.tsx` lines 76-109):
```tsx
<nav className="gsd-app-shell__middle" aria-label="Chapters" aria-hidden={!middleOpen}>
  <div className="gsd-app-shell__pane-content">{chapterNav}</div>
</nav>
<main className="gsd-app-shell__main" aria-label="Editor">
  <div className="gsd-app-shell__pane-content">
    <div className="gsd-global-search" role="search">...</div>
    {editor}
  </div>
</main>
```

**Assignment:** add a config-specific `history` workspace mode and selection/success-notice state to the store; reset history selection/mode when the active config changes. At the App/Shell boundary, keep tracked sidebar visible, hide chapter nav and global editor search in History, and label the main landmark/workspace appropriately. Preserve `ConfigEditor` or lift its draft owner so opening History does not unmount the sole draft state owner.

---

### `web/src/components/editor/ConfigEditor.tsx` (component/hook seam, request-response)

**Analog:** same file's query, mutation, and explicit draft reset lifecycle.

**Query and mutation cache pattern** (lines 59-67, 91-126):
```tsx
const { data: loadResult } = useQuery({
  queryKey: ['config', activeConfigId],
  queryFn: () => loadConfig(activeConfigId!),
  enabled: !!activeConfigId,
});
const saveMutation = useMutation({
  mutationFn: async () => saveConfig(activeConfigId, candidate),
  onSuccess: async (result) => {
    setChanges({});
    setResets(new Set());
    form.reset(defaultValues);
    const refreshed = await loadConfig(activeConfigId);
    queryClient.setQueryData(['config', activeConfigId], refreshed);
  },
  onError: (error) => {
    if (error instanceof ApiError) setServerErrors(normalizeServerErrors(error));
  },
});
```

**Assignment:** extract or expose a draft controller with `isDirty`, normal save, discard/reset, and post-restore reload/reset methods. It must preserve draft while History is shown, support Save draft first before restore, and after restore invalidate/reload `['config', id]`, clear `changes`/`resets` and form state, invalidate `['history', id]`, then switch back to editor. Keep the existing `ApiError` normalization convention and extend it only with classified, content-free restore errors.

---

### `web/src/components/history/HistoryWorkspace.tsx` and `SnapshotTimeline.tsx` (components, request-response/transform)

**Analog:** `web/src/components/specialized/FocusedWorkspace.tsx`.

**Focused sibling workspace layout/back-action pattern** (lines 26-40, 82-114):
```tsx
export function FocusedWorkspace({ descriptor, loadResult, chapter, value, onChange }: FocusedWorkspaceProps) {
  const { setFocusedPath } = useUiStore();
  const back = () => setFocusedPath(null, null);
  return (
    <section className="gsd-focused-workspace" aria-label={`${descriptor.path} focused editor`}>
      <div className="gsd-focused-workspace__header">
        <button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={back}>
          Back to {chapter}
        </button>
        ...
      </div>
      <div className="gsd-focused-workspace__body">...</div>
    </section>
  );
}
```

**Selection/list state pattern** (lines 31-34, 94-104):
```tsx
const [selectedIndex, setSelectedIndex] = useState<number | null>(isArray && entries.length ? 0 : null);
...
<div className="gsd-pool-list__items" role="listbox" aria-label="Select a map entry">
  {mapEntries.map(({ key }) => (
    <div key={key} role="option" aria-selected={selectedKey === key} className={...}>
      <button type="button" className="gsd-pool-list__select" onClick={() => setSelectedKey(key)}>
```

**Assignment:** HistoryWorkspace owns/useQueries the opaque-ID history list and selected comparison payload, exposes Back to editor, and renders a timeline plus comparison pane without navigation. Timeline groups newest-first metadata under Today/Yesterday/date headings, represents the selected snapshot in accessible selection semantics, exposes relative/exact time, sequence, and changed-key count, and shows a no-snapshots empty state with a back route. Never compare to form/draft values.

---

### `web/src/components/history/SnapshotDiff.tsx` and `HistoryDiffTree.tsx` (components, transform)

**Analogs:** `web/src/components/specialized/SecretField.tsx` for temporary redaction/reveal safeguards; no structural diff-tree analog exists.

**Sensitive-value safeguard pattern** (`SecretField.tsx` lines 11-32, 35-45):
```tsx
const REMASK_AFTER_MS = 15_000;
const [revealed, setRevealed] = useState(false);
const remask = () => {
  setRevealed(false);
  if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  timerRef.current = null;
};
const reveal = () => {
  if (disabled) return;
  setRevealed(true);
  if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  timerRef.current = window.setTimeout(() => setRevealed(false), REMASK_AFTER_MS);
};
```

**Assignment:** create a deep non-mutating redacted presentation projection before summary extraction or `Differ.diff`. Feed only redacted objects to `json-diff-kit`; raw snapshot JSON must remain server-side for restore. `SnapshotDiff` owns stable labels `Snapshot`/`Before → Current`, exhaustive added/removed/changed counts and changed key paths, and a Restore entry point. `HistoryDiffTree` owns D-11 rendering: all changed nodes plus parent context visible, unchanged branches initially collapsed behind accessible expand controls, inline `before → current` scalar values, blocks for long/nested values, and text/icon labels in addition to color. Install and inspect `json-diff-kit` public result types before binding a custom tree; do not implement a replacement recursive diff algorithm or fall back to text diff.

---

### `web/src/components/history/RestoreDialogs.tsx` (component, event-driven)

**Analog:** `web/src/components/specialized/FocusedWorkspace.tsx` lines 115-123.

```tsx
{(removingIndex !== null || removingKey !== null) && (
  <div className="gsd-dialog-overlay" role="presentation">
    <div className="gsd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-entry-title">
      <h2 id="remove-entry-title">Remove ...?</h2>
      <p>...</p>
      <div className="gsd-dialog__actions">
        <button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={...}>Cancel</button>
        <button type="button" className="gsd-button gsd-button--danger gsd-button--md" onClick={...}>Remove entry</button>
      </div>
    </div>
  </div>
)}
```

**Assignment:** generalize this visual/dialog class treatment into restore-review and dirty-draft-decision dialogs, but improve it to modal alert-dialog behavior required by research: initial focus on least-destructive action, Tab/Shift+Tab trapping, Escape cancel, background inert, and focus restoration to the opener. Review names config/time, count summary, and recovery snapshot guarantee. If dirty, show exactly Save draft first / Discard draft and restore / Cancel. Disable final restore while mutation is pending; on failure retain selected snapshot/diff and show a classified message explaining whether disk stayed unchanged.

---

### `web/src/styles.css` and `package.json` (config, transform/batch)

**Analogs:** existing `gsd-*` component-class convention and `package.json` dependency declarations (lines 26-42).

```json
"dependencies": {
  "@tanstack/react-query": "5.101.2",
  "react": "19.2.7",
  "react-dom": "19.2.7",
  "zustand": "5.0.14"
}
```

**Assignment:** add `json-diff-kit` as exact approved runtime dependency `1.0.35`, update its lockfile through npm, and add isolated History CSS classes following existing `gsd-` BEM-style names. Use responsive behavior that preserves snapshot context and comparison readability; styles cannot be the only add/remove/change signal.

---

### `test/server/snapshot-store.test.ts` and `test/server/history-routes.test.ts` (tests, file-I/O/request-response)

**Analogs:** `test/server/snapshot-store.test.ts` and its real-filesystem setup (lines 0-41, 43-65).

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), 'gsdcm-snapshot-store-project-'));
  appDataRoot = mkdtempSync(join(tmpdir(), 'gsdcm-snapshot-store-appdata-'));
  configPath = join(projectDir, 'config.json');
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(appDataRoot, { recursive: true, force: true });
});
```

**Core assertion pattern** (lines 140-155):
```ts
const result = await saveWithSnapshot(configPath, { a: 'bad' }, alwaysInvalid, { root: appDataRoot });
expect(result.ok).toBe(false);
expect(readFileSync(configPath, 'utf8')).toBe(original);
```

**Assignment:** add trusted-reader tests for bad/noninteger/missing sequence, malformed index, noncanonical index filename/path traversal, and cross-config isolation. Route tests should build the real guarded app and exercise token envelope behavior, newest-first list, detail current-vs-snapshot source, 404/400/422 mappings, restore recovery snapshot, validation blocking, and nonfatal history warning without secret/path disclosure.

---

### `test/web/history-workspace.test.tsx` (test, request-response/event-driven)

**Analog:** `test/web/sidebar-workspace.test.tsx`.

**Module-mock and UI interaction pattern** (lines 7-43, 61-83):
```tsx
vi.mock('../../web/src/api/configs.js', async () => {
  const actual = await vi.importActual('../../web/src/api/configs.js') as object;
  return { ...actual, loadConfig: vi.fn() };
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  window.history.replaceState({}, '', '/');
});

renderWeb(<App connected />);
await waitFor(() => screen.getByText('alpha/config.json'));
fireEvent.click(screen.getByText('alpha/config.json'));
await waitFor(() => screen.getByText('Config editor'));
```

**Assignment:** mock the thin history wrappers and render the actual App/workspace seam. Assert date grouping/order, selected row updates snapshot→current diff, complete changed-path summary/tree and masked secret absence, no-history state, preserved draft on entry/back, each dirty-draft restore choice, cache refresh/reset/success notice on restore, retained selection/diff + classified failure, and keyboard modal behavior (initial focus, trapping, Escape, focus return).

## Shared Patterns

### API security and opaque identity
**Sources:** `packages/server/src/app.ts` lines 99-111; `packages/server/src/routes/configs.ts` lines 70-79.

All history endpoints belong in the existing encapsulated `/api` plugin so CORS, origin guard, and token guard run before routes. Resolve `req.params.id` through `registry.resolve`; browser data must never be a config path, snapshot directory, filename, or `join()` input.

### Safe restore/write boundary
**Source:** `packages/server/src/snapshot-store/save-with-snapshot.ts` lines 116-199.

```ts
const result = await saveWithSnapshot(tracked.path, snapshotConfig, getValidator(), {
  root: snapshotRoot,
  warn,
});
if (!result.ok) return reply.code(422).send({ ok: false, errors: result.errors });
return { ok: true, snapshotId: result.snapshotId, warning: result.warning };
```

Restore cannot import/use `copyFile`, `rename`, direct `writeFile`, or `saveConfig`. `saveWithSnapshot` serializes same-path operations, validates, atomically writes, snapshots current saved content first, and preserves the established non-blocking history-recording warning.

### Client API errors and cache state
**Sources:** `web/src/api/client.ts` lines 11-40; `web/src/components/editor/ConfigEditor.tsx` lines 117-125.

```ts
if (path.startsWith('/api')) {
  const token = getLaunchToken();
  if (token) headers.set('x-gsd-token', token);
}
...
if (body.ok === false) throw new ApiError(err.errors);
```

Use `apiFetch`, React Query `['config', id]` and `['history', id]` keys, and `ApiError` for server failures. Following a successful restore, refresh both queries and deliberately reset stale draft state.

### Sensitive display handling
**Source:** `web/src/components/specialized/SecretField.tsx` lines 11-45.

The existing UI masks sensitive values by default, can reveal temporarily, and remasks on blur/timer. For History, redaction must occur before diff computation, counts, key-path summaries, confirmation copy, DOM output, errors, or diagnostics; never stringify/log raw snapshot contents.

### UI component and dialog conventions
**Sources:** `web/src/components/specialized/FocusedWorkspace.tsx` lines 82-123; `web/src/components/sidebar/CreateConfigDialog.tsx` lines 33-76.

Use semantic `section`, explicit labels, `gsd-*` classes, `type="button"`, and existing button variants. Reuse visual dialog treatment but upgrade restore dialogs with the required focus/inert behavior; current dialogs are only a styling/markup analog, not a complete accessibility implementation.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `web/src/components/history/HistoryDiffTree.tsx` | component | transform | The codebase has no structural object-diff/tree renderer. Use `json-diff-kit` for comparison result, then a project-owned accessible renderer per RESEARCH.md. |
| `package-lock.json` | config | batch | No committed npm lockfile exists in this checkout; create/update only as npm generates it when adding the approved dependency. |

## Metadata

**Analog search scope:** `packages/server/src/{snapshot-store,routes,app,api-types}.ts`, `web/src/{api,state,components}`, `test/server`, `test/web`, root `package.json`  
**Files scanned:** 15 source/test/config analogs  
**Pattern extraction date:** 2026-07-19
