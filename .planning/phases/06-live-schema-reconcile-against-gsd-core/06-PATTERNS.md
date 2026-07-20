# Phase 6: Live Schema Reconcile Against gsd-core - Pattern Map

**Mapped:** 2026-07-20  
**Files analyzed:** 24 planned new/modified implementation and test files  
**Analogs found:** 18 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/schema-data/src/source-types.ts` | model | transform | `packages/config-io/src/types.ts` | role-match |
| `packages/schema-data/src/reconcile.ts` | service | transform | `packages/schema-data/scripts/build-schema.ts` | role-match |
| `packages/schema-data/scripts/build-schema.ts` | utility | transform | itself; extract pure logic | modification seam |
| `packages/schema-data/bundled-schema-meta.json` | config | file-I/O | `packages/schema-data/bundled-schema.json` | partial |
| `packages/server/src/capability-registry-parser.ts` | utility | transform | no inert-parser analog | none |
| `packages/server/src/upstream-archive.ts` | service | streaming | no untrusted-archive analog | none |
| `packages/server/src/schema-persistence.ts` | service | file-I/O | `packages/config-io/src/atomic-write.ts` | data-flow-match |
| `packages/server/src/active-schema-manager.ts` | provider | request-response | `packages/server/src/schema.ts` | role-match |
| `packages/server/src/schema-refresh-service.ts` | service | request-response, streaming | `packages/server/src/workspace-store.ts` | partial |
| `packages/server/src/schema.ts` | provider | request-response | itself | modification seam |
| `packages/server/src/routes/schema.ts` | route | request-response | `packages/server/src/routes/configs.ts` | exact |
| `packages/server/src/app.ts` | config | request-response | itself | modification seam |
| `packages/server/src/routes/configs.ts` | route | request-response | itself | modification seam |
| `packages/server/src/routes/history.ts` | route | request-response | itself | modification seam |
| `packages/server/src/workspace-store.ts` | store | CRUD, file-I/O | itself | modification seam |
| `packages/server/src/api-types.ts` | model | transform | itself | modification seam |
| `web/src/api/schema.ts` | service | request-response | `web/src/api/configs.ts` | exact |
| `web/src/state/uiStore.ts` | store | event-driven | itself | modification seam |
| `web/src/components/AppShell.tsx` | component | event-driven | itself | modification seam |
| `web/src/components/editor/ConfigEditor.tsx` | component | request-response | `web/src/components/history/HistoryWorkspace.tsx` | partial |
| `web/src/components/schema/SchemaStatusControl.tsx` | component | event-driven | `web/src/components/AppShell.tsx` | role-match |
| `web/src/components/schema/SchemaWorkspace.tsx` | component | request-response | `web/src/components/history/HistoryWorkspace.tsx` | exact |
| `web/src/components/schema/SchemaChangeSummary.tsx` | component | transform | `web/src/components/history/SnapshotTimeline.tsx` | role-match |
| `test/{server,schema-data,web}/schema-refresh*.test.*`, `test/fixtures/schema-refresh/**` | test/fixture | request-response, streaming, transform | `test/server/schema-route.test.ts`, `test/web/history-workspace.test.tsx` | role-match |

## Pattern Assignments

### `packages/schema-data/src/reconcile.ts` and `packages/schema-data/src/source-types.ts` (service/model, transform)

**Analog:** `packages/schema-data/scripts/build-schema.ts`

**Pure-source precedence and descriptor skeleton** (lines 270-304):
```ts
const entries = new Map<string, Entry>();

function addEntry(dotPath: string, entry: Entry): void {
  if (runtimeStateKeySet.has(dotPath)) return;
  entries.set(dotPath, entry);
}

for (const key of manifest.validKeys) {
  if (runtimeStateKeySet.has(key)) continue;
  addEntry(key, {
    type: inferType(key),
    default: inferDefault(key),
    title: deriveTitle(key),
    'x-category': deriveCategory(key),
    'x-description': '',
    'x-provenance': 'manifest',
  });
}
```

**Curated overlay wins and preserves authored-only keys** (lines 438-463):
```ts
const overlay = readJson<Record<string, Partial<Entry>>>(CURATED_DOCS_PATH);
for (const [key, overrides] of Object.entries(overlay)) {
  const existing = entries.get(key);
  if (existing) {
    entries.set(key, { ...existing, ...overrides });
  } else {
    entries.set(key, {
      type: 'string', title: deriveTitle(key),
      'x-category': deriveCategory(key), 'x-description': '',
      'x-provenance': 'curated-docs-only', ...overrides,
    } as Entry);
  }
}
```

**Specialized metadata survives structural rebuilds** (lines 482-500):
```ts
for (const [path, metadata] of Object.entries(specializedMetadata)) {
  const entry = entries.get(path);
  if (entry) entry['x-specialized'] = metadata;
}
```

**Implement:** move path/file/runtime adapters out of this script; export typed pure reconciliation, normalization, stable semantic projection/diff, and deprecation retention. Keep the trusted local `require()` (lines 146-152) solely in the maintainer adapter; remote flows must never reach it.

---

### `packages/server/src/active-schema-manager.ts`, `packages/server/src/schema.ts`, and validation consumers (provider, request-response)

**Analog:** `packages/server/src/schema.ts`

**Bundle-safe baseline import and compile seam** (lines 24-46):
```ts
import bundledSchema from '../../schema-data/bundled-schema.json' with { type: 'json' };
import { buildAjvSchema, createValidator } from '../../config-io/src/index.js';

const SCHEMA = bundledSchema as unknown as Record<string, SchemaEntry>;

export function getBundledSchema(): Record<string, SchemaEntry> {
  return SCHEMA;
}

export function getValidator(): (data: unknown) => ValidationResult {
  if (!cachedValidator) cachedValidator = createValidator(buildAjvSchema(SCHEMA));
  return cachedValidator;
}
```

**Use one injected authority in all config operations:** replace `getBundledSchema()` / `getValidator()` imports in `packages/server/src/routes/configs.ts` (lines 20-23, 82, 113), `packages/server/src/routes/history.ts`, and `packages/server/src/workspace-store.ts` (lines 29-33, 308) with the same manager instance. A manager snapshot is `{ schema, validator, metadata }`, compiled before persistence and swapped by one reference assignment only after durable persistence.

**Baseline-only accessor remains bundle-safe:** retain the JSON module import so npm-tarball execution does not resolve source-relative files.

---

### `packages/server/src/schema-persistence.ts` (service, file-I/O)

**Analog:** `packages/config-io/src/atomic-write.ts`

**Atomic write and retry convention** (lines 63-79):
```ts
export async function writeWithRetry(path: string, content: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      await writeFileAtomic(path, content, { fsync: true, encoding: 'utf8' });
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (!code || !RETRYABLE_CODES.has(code)) throw err;
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt));
    }
  }
  throw lastErr;
}
```

**Failure cleanup convention** (lines 99-111):
```ts
const release = await lock(path, { retries: { retries: 5, factor: 1.3 }, stale: 10_000 });
try {
  // validate before write
  await writeWithRetry(path, JSON.stringify(obj, null, 2));
} finally {
  await release();
}
```

**Implement:** persist exactly one versioned override envelope containing schema and source/status metadata, not separate files. On read/parse/envelope/compile failure, catch internally, quarantine/ignore it, return the bundled fallback plus a static warning state; do not leak storage paths.

---

### `packages/server/src/schema-refresh-service.ts`, `upstream-archive.ts`, and `capability-registry-parser.ts` (service/utility, streaming and transform)

**Analog:** no direct untrusted-network/AST/archive analog exists.

**Closest service boundary:** `packages/server/src/workspace-store.ts` uses injected root state and catches expected filesystem failure without exposing internals (lines 94-111):
```ts
function loadPersisted(root: string): PersistedWorkspace['configs'] {
  const file = configFilePath(root);
  if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as PersistedWorkspace;
    if (data.version !== 1 || !Array.isArray(data.configs)) return [];
    return data.configs;
  } catch {
    return [];
  }
}
```

**Required implementation pattern from research (no codebase analog):** inject `fetch`/clock/store/archive reader for deterministic tests; fixed GitHub endpoints only; resolve latest non-draft/non-prerelease stable tag to a commit before fetch; cap body/archive/entries and inspect the four exact allowlisted paths in memory; reject links, traversal, duplicates, missing sources, unsupported AST nodes, and all malformed/conflicting evidence. Use TypeScript `createSourceFile` and literal-only recursive conversion; never use `require`, `import`, `eval`, `Function`, `vm`, or extraction to disk. Convert expected failures to a static safe error/result, retain active snapshot, and discard partial proposal.

---

### `packages/server/src/routes/schema.ts`, `api-types.ts`, and `app.ts` (route/model/config, request-response)

**Analog:** `packages/server/src/routes/configs.ts` and `packages/server/src/app.ts`

**Route registration and frozen envelopes** (`routes/configs.ts` lines 33-67):
```ts
function errBody(message: string): ApiErr {
  return { ok: false, errors: [{ message }] };
}

app.post<{ Body: { path: string } }>(
  '/configs/track',
  { schema: { body: TRACK_BODY_SCHEMA } },
  async (req, reply) => {
    try {
      const config = registry.track(req.body.path);
      return { ok: true, config };
    } catch (err) {
      if (err instanceof RegistryError) return reply.code(400).send(errBody(err.message));
      throw err;
    }
  },
);
```

**Do not repeat auth in routes:** `app.ts` installs CORS, Origin, then token guard once within the `/api` encapsulation (lines 100-113):
```ts
await app.register(async (api) => {
  await api.register(fastifyCors, buildCorsOptions(opts.ctx));
  registerOriginGuard(api, opts.ctx);
  registerTokenGuard(api, opts.ctx);
  await api.register(schemaRoutes);
}, { prefix: '/api' });
```

**Path-free unexpected-error policy** (`app.ts` lines 86-92):
```ts
app.setErrorHandler((err, req, reply) => {
  if (err.validation) return reply.code(400).send({ ok: false, errors: [{ message: 'Invalid request body' }] });
  warn(`Unhandled error on ${req.method} ${req.url}: ${err.message}`);
  return reply.code(500).send({ ok: false, errors: [{ message: 'Internal error' }] });
});
```

**Implement:** add typed `status`, `refresh`, proposal, `activate`, cancel, and reset payloads additively to `api-types.ts`; inject manager/refresh service through `BuildAppOptions`; routes must accept no repo/ref/archive/path input. Keep current `GET /schema` path but return manager schema/status as additive data. Route-level handled failures must use static approved messages.

---

### `web/src/api/schema.ts` and `web/src/state/uiStore.ts` (service/store, request-response and event-driven)

**Analogs:** `web/src/api/schema.ts` and `web/src/state/uiStore.ts`

**Thin token-aware API wrapper** (`web/src/api/schema.ts` lines 1-5):
```ts
import { apiFetch } from './client';

export function getSchema() {
  return apiFetch<{ schema: Record<string, SchemaEntry> }>('/api/schema').then((r) => r.schema);
}
```

**Zustand mode/action convention** (`web/src/state/uiStore.ts` lines 14-20, 47-54):
```ts
workspaceMode: 'editor',
selectedHistorySeq: null,
openHistory: () => set({ workspaceMode: 'history', selectedHistorySeq: null }),
backToEditor: () => set({ workspaceMode: 'editor' }),
```

**Implement:** use typed wrappers around `apiFetch` for lifecycle mutations; extend the union with `schema`, add `openSchemaMaintenance`, and keep proposal/filter/disclosure state local to the workspace unless it must persist across app-shell remounts. Activation/reset must invalidate `['schema']` and the selected `['config', activeConfigId]` query before returning to normal editing.

---

### `web/src/components/AppShell.tsx`, `SchemaStatusControl.tsx`, and `SchemaWorkspace.tsx` (components, event-driven/request-response)

**Analogs:** `web/src/components/AppShell.tsx` and `web/src/components/history/HistoryWorkspace.tsx`

**Dedicated workspace shell behavior** (`AppShell.tsx` lines 67-109):
```tsx
{mode === 'editor' && <button ... onClick={onToggleMiddle}>...</button>}
{mode === 'editor' && <nav className="gsd-app-shell__middle" aria-label="Chapters">...</nav>}
<main className="gsd-app-shell__main" aria-label={mode === 'history' ? 'Version history' : 'Editor'}>
  <div className="gsd-app-shell__pane-content">
    {mode === 'editor' && <div className="gsd-global-search" role="search">...</div>}
    {editor}
  </div>
</main>
```

**Query + mutation recovery pattern** (`HistoryWorkspace.tsx` lines 77-108):
```tsx
setPending(true);
setRestoreError(null);
try {
  const result = await restoreConfigSnapshot(idAtStart, selectedAtStart);
  const reloaded = await loadConfig(idAtStart);
  queryClient.setQueryData(['config', idAtStart], reloaded);
  await queryClient.invalidateQueries({ queryKey: ['history', idAtStart] });
  backToEditor();
} catch (error) {
  if (useUiStore.getState().activeConfigId === idAtStart) {
    setRestoreError({ kind: 'restore-failed', reason: safeRestoreReason(error) });
  }
} finally { setPending(false); }
```

**Accessible static error mapping** (`HistoryWorkspace.tsx` lines 27-34):
```ts
function safeRestoreReason(error: unknown) {
  if (error instanceof ApiError) {
    const message = error.message.toLowerCase();
    if (message.includes('validation')) return 'Fix the validation issue and try again.';
  }
  return 'The restore could not be completed. Try again.';
}
```

**Implement:** add `schema` mode and main label `Schema maintenance`; preserve the tracked sidebar, hide chapter nav/search/save/editor-specific heading. Status control is a persistent rail utility with query-derived source/version/date and warning badge, usable with no selected config. Workspace uses React Query status + mutation state, named check stages, safe `role=status` announcements, `role=alert` failures, focus-to-`h1` on entry, and a local reset dialog matching the existing inert/focus-trap pattern below.

---

### Reset confirmation dialog within `SchemaWorkspace.tsx` (component, event-driven)

**Analog:** `web/src/components/history/RestoreDialogs.tsx`

**Modal focus, inertness, and Escape contract** (lines 27-50):
```tsx
useEffect(() => {
  if (!mode) return;
  returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.getElementById('root')?.setAttribute('inert', '');
  cancelRef.current?.focus();
  return () => {
    document.getElementById('root')?.removeAttribute('inert');
    returnFocusRef.current?.focus();
  };
}, [mode]);

if (event.key === 'Escape' && !pending) { event.preventDefault(); onCancel(); return; }
if (event.key !== 'Tab') return;
```

**Implement:** initial focus must be **Keep current schema**, use `role="alertdialog"`, trap Tab, disable actions during mutation, and return focus to reset. Keep dialog project-owned; do not add a UI library.

---

### Tests and frozen fixtures (test, request-response/streaming/transform)

**Server API analog:** `test/server/schema-route.test.ts` lines 32-69.
```ts
beforeEach(async () => {
  clientRoot = mkdtempSync(join(tmpdir(), 'gsdcm-schema-client-'));
  app = await buildApp({ ctx: makeContext(), clientRoot });
});

afterEach(async () => {
  await app.close();
  rmSync(clientRoot, { recursive: true, force: true });
});

const res = await app.inject({ method: 'GET', url: '/api/schema', headers: authHeaders() });
expect(res.statusCode).toBe(200);
expect(res.json().ok).toBe(true);
```

**Component test analog:** `test/web/history-workspace.test.tsx` (use existing render helpers and mocked API module conventions) and the component's injectable `embedded`/`viewportWidth` seams in `HistoryWorkspace.tsx` lines 11-20.

**Implement test split from research:**
- Add deterministic `test/fixtures/schema-refresh/**`; ordinary tests never call GitHub.
- Unit-test release validation/fail-closed service, archive caps/allowlist/link/traversal/duplicates, and AST literal acceptance/rejection.
- Unit-test pure reconciliation for curated overlay retention, documentation drift, deprecated-key preservation, and order-insensitive semantic diff.
- Integration-test manager compile-before-swap, one-envelope persistence, corrupt override fallback/quarantine/version precedence/reset, and guarded lifecycle routes.
- Component-test schema mode/status control, staged workspace/review filters/disclosures, no-op state, query invalidation, static failure copy, and reset dialog keyboard focus.

## Shared Patterns

### API authentication and error redaction
**Sources:** `packages/server/src/app.ts` lines 77-113; `packages/server/src/routes/configs.ts` lines 33-67.  
**Apply to:** every Phase 6 `/api/schema*` endpoint. Routes are only registered under the guarded plugin; controlled errors use `ApiErr`; unexpected errors remain server-side and clients receive a static path-free message.

### Atomic durability before active-state switch
**Sources:** `packages/config-io/src/atomic-write.ts` lines 63-79 and 94-111.  
**Apply to:** refreshed override activation and reset. Compile/validate candidate first, atomically write/delete the single state envelope, then replace the manager snapshot reference. On failure retain current memory snapshot and proposal when retry is allowed.

### Canonical schema drives both rendering and saving
**Sources:** `packages/server/src/schema.ts` lines 24-46; `packages/server/src/routes/configs.ts` lines 82 and 113.  
**Apply to:** config GET, PUT, creation, history restore, and client `GET /api/schema`. Replace independent bundled-schema/validator reads with manager reads so both are generation-consistent.

### Dedicated workspace and accessibility
**Sources:** `web/src/components/AppShell.tsx` lines 67-109; `web/src/components/history/HistoryWorkspace.tsx` lines 127-149; `web/src/components/history/RestoreDialogs.tsx` lines 27-79.  
**Apply to:** `schema` workspace. Preserve sidebar orientation, hide editor-only navigation, announce lifecycle safely, and use the established owned modal/focus behavior.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/server/src/upstream-archive.ts` | service | streaming | No untrusted archive inspection exists; follow RESEARCH.md’s fixed allowlist/cap/no-extraction contract. |
| `packages/server/src/capability-registry-parser.ts` | utility | transform | No AST parser exists; follow the literal-only TypeScript AST accept-list in RESEARCH.md. |
| `packages/server/src/schema-refresh-service.ts` | service | request-response/streaming | No fixed-upstream acquisition/proposal service exists; use injected dependencies and safe-result boundaries. |
| `packages/schema-data/bundled-schema-meta.json` | config | file-I/O | Current bundled artifact contains descriptors only; add generated stable identity metadata with validation coverage. |

## Metadata

**Analog search scope:** `packages/schema-data`, `packages/config-io`, `packages/server`, `web/src`, `test`  
**Files scanned:** 18 primary analogs and test seams  
**Pattern extraction date:** 2026-07-20
