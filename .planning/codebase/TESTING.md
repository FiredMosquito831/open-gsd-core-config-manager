# Testing Patterns

**Analysis Date:** 2026-07-31

## Test Framework

**Runner:**
- Vitest 4.1.10 (dev dependency in `package.json`)
- Config: `vitest.config.ts` — `include: ['test/**/*.test.{ts,tsx}']`, default `environment: 'node'`, `watch: false`, `passWithNoTests: true`, `pool: 'vmThreads'`, `hookTimeout: 60_000`, `testTimeout: 60_000`.

**Assertion Library:**
- Vitest's built-in `expect` (no separate assertion library).

**Run Commands:**
```bash
npm test                            # test:ordinary + test:integration
npm run test:ordinary               # all tests except the process-spawning/packaging suites
npm run test:integration            # cli-launch, teardown, process-tree, tarball — --pool=forks --maxWorkers=1 --no-file-parallelism
npm run test:unit                   # vitest run test/config-io --reporter=dot
npm run test:server                 # vitest run test/server --reporter=dot
npm run typecheck                   # tsc --noEmit && tsc -p tsconfig.web.json --noEmit (not a test, but the only static gate)
```

The `test:integration` split exists because the process-spawning and packaging suites are slow and serialize on real ports/sockets: `test/helpers/process-tree.test.ts`, `test/server/cli-launch.test.ts`, `test/server/teardown.test.ts`, `test/packaging/tarball-contents.test.ts`.

## Test File Organization

**Location:**
- All tests live under `test/`, mirroring the source layout rather than co-locating next to source:
  - `test/config-io/` → `packages/config-io/src/`
  - `test/server/` → `packages/server/src/` (including `test/server/helpers/` for shared server-test harness)
  - `test/schema-data/` → `packages/schema-data/src/`
  - `test/web/` → `web/src/`
  - `test/packaging/` → npm tarball/distribution concerns
  - `test/helpers/` → cross-cutting test utilities (`process-tree.ts`)
  - `test/fixtures/` → static JSON fixtures
  - `test/stress/kill-mid-save.mjs` → a manual stress script (not run by vitest)

**Naming:**
- `<module>.test.ts` for logic tests; `<module>.test.tsx` for React component tests. File names match the source module (e.g. `packages/server/src/snapshot-store/index.ts` → `test/server/snapshot-store.test.ts`).
- Shared test helpers are plain `.ts`/`.tsx` files in the same dirs (`test/server/helpers/spawn-cli.ts`, `test/web/render-helpers.tsx`) and are imported, not auto-run.

**Structure:**
```
test/
├── config-io/          # config-io package unit tests
├── server/             # Fastify routes + services + CLI-launch integration
├── schema-data/        # schema reconciliation/completeness
├── web/                # React component + API client + pure web-logic tests
├── packaging/          # npm tarball contents + extracted-tarball smoke run
├── helpers/            # shared process-tree cleanup
└── fixtures/           # JSON fixtures (project configs, fake-home defaults, schema manifests)
```

## Test Structure

**Suite Organization:**
```typescript
// test/config-io/atomic-write.test.ts
const { writeFileAtomicMock } = vi.hoisted(() => ({ writeFileAtomicMock: vi.fn() }));
vi.mock('write-file-atomic', () => ({ default: (...args) => writeFileAtomicMock(...args) }));

describe('writeWithRetry', () => {
  it('retries transient EPERM/EBUSY/EACCES and eventually succeeds', async () => {
    // ...
  });
});
```

- `describe` blocks group by behavior or route; `it` blocks assert one behavior.
- Test titles are load-bearing: `02-VALIDATION.md`'s verification map references several server tests by `-t "<title>"`, so titles are written exactly per the plan's `<behavior>` blocks (see the header comment in `test/server/security.test.ts`).

**Patterns:**
- Setup/teardown uses `beforeEach`/`afterEach`.
- Server route tests build a fresh app per test with `mkdtempSync` temp dirs injected into `buildApp`, then `app.close()` and `rmSync(..., { recursive: true, force: true })` in `afterEach` (`test/server/api-routes.test.ts`, `test/server/security.test.ts`).
- Web tests reset Zustand store state and `window.history` in `afterEach` (`test/web/editor-save.test.tsx`).
- Small helper functions at the top of each test file build fixtures and headers: `makeContext()`, `authHeaders()`, `trackConfig()`, `renderWithActiveConfig()`.

## Mocking

**Framework:** Vitest's `vi` (`vi.mock`, `vi.spyOn`, `vi.fn`, `vi.hoisted`, `vi.mocked`, `vi.importActual`).

**Patterns:**
```typescript
// Module mock with hoisted variable (mock factories are hoisted above imports):
const { writeFileAtomicMock } = vi.hoisted(() => ({ writeFileAtomicMock: vi.fn() }));
vi.mock('write-file-atomic', () => ({ default: (...args) => writeFileAtomicMock(...args) }));

// Partial module mock preserving real exports:
vi.mock('../../web/src/api/configs.js', async () => {
  const actual = await vi.importActual('../../web/src/api/configs.js') as object;
  return { ...actual, loadConfig: vi.fn(), saveConfig: vi.fn() };
});

// Typed access in tests:
vi.mocked(saveConfig).mockResolvedValue({ snapshotId: 'snap-1', revision: 'revision-2' });
vi.mocked(saveConfig).mockRejectedValue(new ApiError([{ message: '...' }], 409));

// Spy on globals/methods:
vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({ ok: true }));
vi.spyOn(Differ.prototype, 'diff');
```

**What to Mock:**
- External modules at the boundary: `write-file-atomic`, the web API layer (`web/src/api/*`) in component tests, `fetch` in API-client tests, `web/src/bootstrap/token.js`.
- Fault injection is done via mocks: `writeFileAtomicMock.mockImplementation(async () => { throw errWithCode('locked', 'EPERM'); })` to prove retry/rethrow behavior without real Windows lock contention.

**What NOT to Mock:**
- The Fastify app itself. Route suites drive the real `buildApp()` through `app.inject()` — no listening socket, no HTTP client. Dependencies are real modules with injected temp paths (`snapshotRoot`, `workspaceRoot`) instead of module mocks.
- Pure logic (e.g. `buildHistoryComparison`, `indexSchema`, `parseBannerUrl`) is tested against real implementations with hand-built inputs.

## Fixtures and Factories

**Test Data:**
- Static JSON fixtures in `test/fixtures/`: `project-config.json`, `global-defaults.json`, `global-defaults-claude-api.json`, `numeric-string-key.json`, `project-config-with-fabricated-unknown-keys.json`, plus `phase4-*` catalog/evidence files and a `fake-home/.gsd/defaults.json` for global-defaults discovery tests.
- Schema-refresh fixtures under `test/fixtures/schema-refresh/valid/`.
- Fixtures are read once at module load with `readFileSync` and copied into per-test `mkdtempSync` temp dirs so they are never mutated in place (`test/server/api-routes.test.ts`).

**Factories:**
- Web component tests build typed in-memory fixtures: `testSchema` (a `Record<string, SchemaEntry>`) and `loadResult` (a `LoadResult`) at the top of each file (`test/web/field-card.test.tsx`, `test/web/editor-save.test.tsx`).
- `test/web/render-helpers.tsx` exports `renderWeb(ui)` which wraps `render` from `@testing-library/react` in a `QueryClientProvider` with `retry: false`, `staleTime: 0`, `refetchOnWindowFocus: false` — the standard mount helper for every React test.

**Location:**
- Shared helpers: `test/web/render-helpers.tsx`, `test/server/helpers/spawn-cli.ts`, `test/helpers/process-tree.ts`.

## Coverage

**Requirements:** None enforced. `vitest.config.ts` has no `coverage` block and `package.json` has no coverage script. Do not assume a threshold gate.

**View Coverage:**
```bash
npx vitest run --coverage   # only works if @vitest/coverage-* is installed (it is not in devDependencies)
```

## Test Types

**Unit Tests:**
- `test/config-io/` — `load`, `merge`, `patch`, `discovery`, `validate`, `atomic-write`, `round-trip-identity`.
- `test/schema-data/` — `reconcile`, `completeness`.
- `test/web/*.test.ts` (no `x`) — pure frontend logic: `history-comparison.test.ts`, `api-client.test.ts`, `schema-index.test.ts`, `patch-project.test.ts`, `client-validation.test.ts`, `security-redaction.test.ts`.
- These run under the default `node` environment.

**Component/Integration (jsdom):**
- `test/web/*.test.tsx` opt into jsdom with the `// @vitest-environment jsdom` docblock as the first line, then mount the real `<App />` with mocked API modules and drive it with `fireEvent`/`waitFor`.
- `test/server/*.test.ts` drive `buildApp()` through `app.inject()` for route-level integration (configs, history, picker, workspace, schema routes, security, snapshot-store, active-schema-manager).

**E2E / Process-Spawn:**
- `test/server/cli-launch.test.ts` and `test/server/teardown.test.ts` spawn the CLI from source via `tsx` using `test/server/helpers/spawn-cli.ts`, parse the launch-banner URL for port + token, hit real HTTP endpoints, and assert clean shutdown.
- `test/packaging/tarball-contents.test.ts` runs `npm pack --dry-run --json` and additionally extracts the real tarball outside the repo, symlinks `node_modules`, spawns the packed `dist/cli.js`, and round-trips real HTTP requests — the only suite that catches missing-inline bundle errors.
- Process cleanup is handled by `terminateProcessTree` (`test/helpers/process-tree.ts`): `taskkill /pid <pid> /T /F` on Windows, `process.kill(-pid, 'SIGKILL')` on POSIX.
- These four suites are excluded from `test:ordinary` and run serialized via `--pool=forks --maxWorkers=1 --no-file-parallelism` because they bind real ports and spawn child processes.

## Common Patterns

**Async Testing:**
```typescript
// Fastify route testing via inject — no real socket:
const res = await app.inject({ method: 'GET', url: '/api/health', headers: authHeaders() });
expect(res.statusCode).toBe(200);

// Web async render + interaction:
renderWeb(<App connected />);
await waitFor(() => screen.getByText('p/config.json'));
fireEvent.click(screen.getByText('p/config.json'));
await waitFor(() => screen.getByRole('tab', { name: 'Core' }));
```

**Error Testing:**
```typescript
// Rejection assertion:
await expect(writeWithRetry('/whatever/config.json', '{}')).rejects.toThrow('bad input');

// Validation-blocked save leaves the file byte-unchanged:
await expect(saveConfig(file, { new: 'data' }, failValidator)).rejects.toThrow(ValidationError);
expect(writeFileAtomicMock).not.toHaveBeenCalled();
expect(readFileSync(file, 'utf8')).toBe(original);

// Security envelope shape is asserted precisely:
function expectForbiddenShape(res: LightMyRequestResponse): void {
  expect(res.statusCode).toBe(403);
  const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
  expect(body.ok).toBe(false);
  expect(body.errors.length).toBeGreaterThan(0);
}
```

**Information-Disclosure assertions:**
```typescript
// No absolute path / secret anywhere in the response body:
expect(res.body).not.toContain(configPath);
expect(res.body).not.toContain(projectDir);
expect(JSON.stringify(comparison)).not.toContain(secret);
```

**Table-driven tests:**
```typescript
it.each([
  ['object to scalar', { replacement: { nested: true } }, { replacement: 'scalar' }],
  ['scalar to object', { replacement: 'scalar' }, { replacement: { nested: true } }],
])('adapts real Differ %s replacement spans as one changed member', (_label, snapshot, current) => {
  // ...
});
```

**Snapshot/history testing:**
- Snapshot-store tests use injected `snapshotRoot` temp dirs and assert on `snapshotDirFor(path, root)` layout (`test/server/api-routes.test.ts`, `test/server/snapshot-store.test.ts`).
- A dedicated worker helper `test/server/helpers/snapshot-record-worker.ts` exercises concurrent snapshot recording.

---

*Testing analysis: 2026-07-31*
