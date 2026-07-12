# Phase 2: Local Loopback Server, CLI & Security Hardening - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 20 (source) + 6 (test/packaging)
**Analogs found:** 20 / 20 (all resolve to Phase 1 monorepo conventions — no prior server/CLI code exists, so analogs are structural/stylistic, not behavioral)

**No prior server, CLI, or HTTP code exists in this repo.** Every new file in Phase 2 is a genuinely new capability (Fastify plugins, Commander CLI, snapshot store) with no direct behavioral analog. The closest real analog for ALL of them is `packages/config-io` — the only existing package — which sets the monorepo's binding conventions: strict TSDoc module-header comments explaining *why*, barrel-only `index.ts` exports, dependency-injected functions (not classes) for testability, `finally`-guarded resource cleanup, and non-disclosure of sensitive payloads in errors/logs. RESEARCH.md's `## Code Examples` / Pattern 1-7 sections are the primary source of *what* to write; this file's job is to pin down *house style* from the one real precedent (`config-io`) plus the test-fixture conventions already established.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/server/src/app.ts` | service (composition root) | request-response | `packages/config-io/src/index.ts` (barrel/composition style) | style-match |
| `packages/server/src/plugins/host-guard.ts` | middleware | request-response | `packages/config-io/src/atomic-write.ts` (guard-then-throw structure) | role-match |
| `packages/server/src/plugins/cors.ts` | middleware/config | request-response | `packages/config-io/src/validate.ts` (small config-producing module) | role-match |
| `packages/server/src/plugins/token-guard.ts` | middleware | request-response | `packages/config-io/src/atomic-write.ts` (guard pattern) | role-match |
| `packages/server/src/routes/configs.ts` | route/controller | CRUD (request-response) | none in-repo — RESEARCH.md §Code Examples is primary source | no analog |
| `packages/server/src/snapshot-store/paths.ts` | utility | file-I/O | `packages/config-io/src/discovery.ts` (path-resolution utility) | exact (role+flow) |
| `packages/server/src/snapshot-store/index.ts` | service | file-I/O, event-driven (on-save) | `packages/config-io/src/atomic-write.ts` (`saveConfig`: lock→write→finally) | role-match |
| `packages/server/src/snapshot-store/save-with-snapshot.ts` | service (wrapper/composition) | file-I/O | `packages/config-io/src/atomic-write.ts` (`saveConfig`, directly composed) | exact |
| `packages/server/src/static/serve.ts` | config/middleware | file-I/O (static) | none in-repo — RESEARCH.md Pattern 1 is primary source | no analog |
| `packages/cli/src/cli.ts` | CLI entry | request-response (process bootstrap) | none in-repo — RESEARCH.md §Code Examples "Commander 15 CLI skeleton" is primary source | no analog |
| `packages/cli/src/bootstrap.ts` | service (orchestration) | event-driven (signals) | `packages/config-io/src/atomic-write.ts` (`saveConfig`: acquire→use→release-in-finally maps to listen→run→close-in-signal-handler) | role-match |
| `test/server/security.test.ts` | test | request-response (inject) | `test/config-io/atomic-write.test.ts` (`vi.mock`/`vi.hoisted`, describe-per-behavior, arrange/act/assert) | exact (test style) |
| `test/server/cli-launch.test.ts` | test | event-driven (spawned process) | `test/config-io/discovery.test.ts` (env/fixture-driven black-box assertions) | role-match |
| `test/server/teardown.test.ts` | test | event-driven (spawned process/signals) | `test/config-io/discovery.test.ts` + `spawnCli()` helper (new) | role-match |
| `test/server/snapshot-store.test.ts` | test | file-I/O | `test/config-io/atomic-write.test.ts` (temp-dir fixture via `mkdtempSync`/`tmpdir`) | exact (test style) |
| `test/packaging/tarball-contents.test.ts` | test | batch (build artifact assertion) | none in-repo — new test category | no analog |
| `test/server/helpers/spawn-cli.ts` | test utility | event-driven (process spawn) | `test/config-io/discovery.test.ts` (fixture-path helper functions) | role-match |
| `packages/cli/tsup.config.ts` | config (build) | batch | none in-repo (no build config exists yet) | no analog — RESEARCH.md §Code Examples is primary source |
| root `package.json` (modified) | config | n/a | existing root `package.json` (this repo, modify in place) | exact |
| root `tsconfig.json` (modified, add `packages/cli`/`packages/server` to include if needed) | config | n/a | existing root `tsconfig.json` | exact |

## Pattern Assignments

### `packages/server/src/app.ts` (composition root)

**Analog:** `packages/config-io/src/index.ts`

**Barrel/composition style** (lines 1-12 of `index.ts`):
```typescript
/**
 * Public config-io API barrel — the single import surface Phase 2's
 * loopback server and Phase 3's schema-driven UI build against.
 *
 * Frozen: adding/renaming an export here after this plan lands is an
 * expensive downstream change (01-CONTEXT.md § Integration Points). Keep
 * this file import-only — no logic lives here.
 */
```
**Apply to `app.ts`:** Lead the file with a module-header comment stating what it composes and why (the Host-guard-then-static-then-/api-plugin ordering from RESEARCH.md Pattern 1), keep `buildApp()` a single exported factory function (not a class), inject the runtime-computed values (`launchToken`, `allowedHosts`, `corsOrigin`) as an options object parameter — mirrors `createValidator(schema)` and `saveConfig(path, obj, validate)`'s dependency-injection style so tests can supply fakes without module mocking where possible.

---

### `packages/server/src/plugins/host-guard.ts`, `token-guard.ts` (middleware/guards)

**Analog:** `packages/config-io/src/atomic-write.ts` `saveConfig` guard-then-throw shape

**Guard pattern** (lines 95-113):
```typescript
export async function saveConfig(
  path: string,
  obj: object,
  validate: (data: unknown) => ValidationResult,
): Promise<void> {
  const release = await lock(path, { retries: { retries: 5, factor: 1.3 }, stale: 10_000 });
  try {
    const result = validate(obj);
    if (!result.valid) {
      throw new ValidationError(path, result.errors);
    }
    await writeWithRetry(path, JSON.stringify(obj, null, 2));
  } finally {
    await release();
  }
}
```
**Apply to guards:** Same "check condition, short-circuit with a typed rejection, never leak the payload" shape — `formatErrors`/`ValidationError` never include the config body (Information Disclosure guard); the token/Host guards must equally never echo the received token/Origin value back in the 403 body, only a static message (`{ ok: false, errors: [{ message: 'Host not allowed' }] }` per RESEARCH.md Pattern 1 — no request internals reflected).

---

### `packages/server/src/plugins/cors.ts` (small config-producing module)

**Analog:** `packages/config-io/src/validate.ts`

**Config-producing function + defensive comment style** (lines 55-79, condensed):
```typescript
export function createValidator(schema: object): (data: unknown) => ValidationResult {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true, allowMatchingProperties: true });
  addFormats(ajv);
  for (const keyword of VENDOR_KEYWORDS) {
    ajv.addKeyword({ keyword });
  }
  const validateFn = ajv.compile(schema);
  return (data: unknown): ValidationResult => { ... };
}
```
**Apply to `cors.ts`:** A single exported factory (`buildCorsOptions(origin: string)`) returning the `@fastify/cors` options object, with an inline comment explaining *why* (ReDoS/Pitfall 6 — exact string/Set comparison only, never regex), matching `validate.ts`'s pattern of "one exported function, heavily commented on the non-obvious safety reasoning, no class."

---

### `packages/server/src/snapshot-store/paths.ts` (path-resolution utility)

**Analog:** `packages/config-io/src/discovery.ts` (via its test, `discovery.test.ts`)

**Pattern:** Pure, synchronous, environment-injectable path-resolution functions (`resolveGlobalDefaultsPath(env)` takes `NodeJS.ProcessEnv` as a parameter rather than reading `process.env` directly, so tests can pass a fake env object):
```typescript
// test/config-io/discovery.test.ts (usage, proving the injectable-env contract)
const result = resolveGlobalDefaultsPath({ GSD_HOME: 'test/fixtures' } as NodeJS.ProcessEnv);
expect(result).toBe(path.join('test/fixtures', '.gsd', 'defaults.json'));
```
**Apply to `snapshot-store/paths.ts`:** `snapshotDirFor(configPath, envPathsRoot?)` should similarly accept its app-data root as an injectable parameter (or accept an already-resolved `paths.data` value) rather than calling `envPaths(...)` internally every time — keeps it unit-testable without mocking `env-paths`, exactly like `discovery.ts` avoids hard-coding `process.env` access inside the exported function body.

---

### `packages/server/src/snapshot-store/index.ts` + `save-with-snapshot.ts` (service, file-I/O)

**Analog:** `packages/config-io/src/atomic-write.ts` (`saveConfig`, directly composed per D-10)

**Composition, not modification** (lines 95-113, reproduced above) — `save-with-snapshot.ts` literally imports and calls `saveConfig` unmodified:
```typescript
import { saveConfig, ValidationError } from '@gsd-config-manager/config-io';
```
**Apply:** `saveWithSnapshot` must follow the exact same "acquire/read → do the risky operation → best-effort side-record in a way that cannot fail the primary operation" shape that `saveConfig` uses for lock/release — but note the asymmetry D-12 requires: `saveConfig`'s `finally`-release always runs and any failure there propagates, whereas `recordSnapshot`'s failure must be caught and *swallowed into a warning*, never rethrown. Use a `try { ... } catch (err) { console.warn(...) }` block around only the snapshot call, structured identically to how `atomic-write.ts` isolates the lock-release `finally` from the validate/write logic above it — i.e., one clearly-scoped try block per concern, not one blanket try/catch around the whole function.

---

### `packages/cli/src/bootstrap.ts` (orchestration, event-driven/signals)

**Analog:** `packages/config-io/src/atomic-write.ts` acquire→use→release-in-finally shape, applied to process lifecycle

**Pattern to mirror:** the lock/release symmetry in `saveConfig` (`const release = await lock(...); try { ... } finally { await release(); }`) maps directly onto the SIGINT handler's `await app.close()` requirement from RESEARCH.md Pattern 5 — resource acquisition and release must be structurally paired and the release step must always be awaited, never fire-and-forget. Use RESEARCH.md's own Pattern 5 code block as the primary source for the signal-handler body itself (it is complete and ready to adapt); this repo's contribution is only the "always await release, always use `finally`/re-entrancy guard" discipline already proven in `atomic-write.ts`.

---

### Test files — `test/server/*.test.ts`, `test/packaging/*.test.ts`

**Analog:** `test/config-io/atomic-write.test.ts` (mocking + fixture style) and `test/config-io/discovery.test.ts` (env/path-fixture style)

**Imports + `vi.hoisted`/`vi.mock` pattern** (lines 1-20 of `atomic-write.test.ts`):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { writeFileAtomicMock } = vi.hoisted(() => ({ writeFileAtomicMock: vi.fn() }));
vi.mock('write-file-atomic', () => ({
  default: (...args: unknown[]) => writeFileAtomicMock(...(args as Parameters<typeof writeFileAtomicMock>)),
}));
```
**Apply to `snapshot-store.test.ts`:** Same `vi.hoisted` + `vi.mock` shape if mocking `env-paths` to redirect the app-data root into a temp dir; same `mkdtempSync(join(tmpdir(), 'gsdcm-<feature>-'))` temp-directory-per-test-file naming convention (`gsdcm-atomic-write-` → use `gsdcm-snapshot-store-`, `gsdcm-cli-launch-`, etc.).

**Describe/it structure + requirement-ID comments** (lines 108-140):
```typescript
describe('saveConfig — validation-blocks-write gate (SAVE-01)', () => {
  it('does NOT call writeFileAtomic when validation fails, and the on-disk file is byte-unchanged', async () => {
    ...
  });
});
```
**Apply to `security.test.ts`:** Name each `describe` block after the behavior + its requirement ID (`describe('token guard — rejects missing token on reads (SEC-02, D-04)', ...)`), matching this repo's convention of tracing every test block back to a REQUIREMENTS.md ID directly in the description string.

**Injectable-parameter fixture style** (lines 6-23 of `discovery.test.ts`):
```typescript
const result = resolveGlobalDefaultsPath({ GSD_HOME: 'test/fixtures' } as NodeJS.ProcessEnv);
```
**Apply to `cli-launch.test.ts`/`teardown.test.ts`:** Build the new `spawnCli()` test helper (RESEARCH.md's Wave-0 gap list) to accept injectable args/env/cwd parameters the same way, returning `{ proc, port, url }`, and assert against those returned values rather than parsing stdout ad hoc in every test.

**No analog for `tarball-contents.test.ts`:** this is a genuinely new test category (parses `npm pack --dry-run --json`). Use RESEARCH.md's Pitfall 5 guidance directly (assert `dist/client/index.html` and `dist/cli.js`/`bin` entry presence programmatically) — no in-repo precedent to match style against beyond the same `describe`/`it` + requirement-ID-in-description convention above.

---

### `package.json` (root, modified) and new `tsup.config.ts`

**Analog:** existing root `package.json`

**Current shape** (full file, 33 lines) — dependencies are flat, pinned exact versions (no `^`/`~`), `scripts` are short one-liners, `type: "module"`:
```json
{
  "dependencies": {
    "ajv": "8.20.0",
    "ajv-formats": "3.0.1",
    "proper-lockfile": "4.1.2",
    "write-file-atomic": "7.0.1"
  },
  "devDependencies": {
    "@types/node": "26.1.1",
    "@types/proper-lockfile": "4.1.4",
    "tsx": "4.23.0",
    "typescript": "5.9.3",
    "vitest": "4.1.10"
  }
}
```
**Apply:** Add Phase 2 deps (`fastify`, `@fastify/static`, `@fastify/cors`, `commander`, `open`, `env-paths`) as exact pinned versions matching CLAUDE.md's table (no `^`), `tsup` under `devDependencies` — continue the "no caret" convention already established. Add `bin`, `files`, and `build`/`prepublishOnly` scripts per RESEARCH.md's `## Code Examples` §"package.json packaging fields" block verbatim as the starting point.

---

## Shared Patterns

### Module-header TSDoc comments explaining "why," not just "what"
**Source:** every file in `packages/config-io/src/` (see `atomic-write.ts` lines 1-25, `validate.ts` lines 1-16)
**Apply to:** all new Phase 2 source files — lead each file with a comment block citing the relevant CONTEXT.md decision ID (D-01..D-12) or RESEARCH.md Pattern/Pitfall number, exactly as Phase 1 cites `01-RESEARCH.md § Decision: ...`. This is the single most consistent stylistic convention in the codebase and downstream reviewers will expect it.

### Dependency injection over module-level singletons
**Source:** `packages/config-io/src/validate.ts` (`createValidator(schema)` returns a closure), `packages/config-io/src/atomic-write.ts` (`saveConfig(path, obj, validate)` takes `validate` as a parameter, not an import)
**Apply to:** `buildApp(opts)`, `saveWithSnapshot(configPath, nextConfig, validate)` (RESEARCH.md Pattern 7 already follows this), `snapshotDirFor` — anything Fastify/CLI-related that touches a runtime-computed value (port, token, origin, app-data root) should take it as a parameter, never read a module-level global, to preserve the existing repo's unit-testability-without-mocking style.

### Non-disclosure of sensitive payloads in errors/logs
**Source:** `packages/config-io/src/atomic-write.ts` `ValidationError` (never includes the config body) + `packages/config-io/src/validate.ts` `formatErrors` (only `instancePath`/`keyword`, never the offending value)
**Apply to:** all Phase 2 error responses and log lines — 403 guard rejections never echo the bad token/Origin/Host value back; snapshot-failure warnings never log snapshot content (RESEARCH.md Security Domain table already states this explicitly for Phase 2).

### `finally`-guarded resource release, always awaited
**Source:** `packages/config-io/src/atomic-write.ts` lines 100-112 (`try { ... } finally { await release(); }`)
**Apply to:** the SIGINT/SIGTERM shutdown handler (`await app.close()` must be awaited before `process.exit`, per RESEARCH.md Pitfall 2) and any snapshot-store file-locking — this repo already has a hard rule against fire-and-forget cleanup.

### Test temp-dir-per-file naming + `vi.hoisted`/`vi.mock`
**Source:** `test/config-io/atomic-write.test.ts` lines 1-36
**Apply to:** all new `test/server/*.test.ts` and `test/packaging/*.test.ts` files — `mkdtempSync(join(tmpdir(), 'gsdcm-<feature>-'))`, `vi.hoisted` for any mocked module-level fn, `describe` blocks named with the requirement ID inline.

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md's `## Code Examples` / Pattern sections as the primary source instead of an in-repo analog):

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/server/src/routes/configs.ts` | route/controller | CRUD | First HTTP route handler in the repo; use RESEARCH.md System Architecture Diagram + Pattern 1 route-registration example as the primary source, follow config-io's error-shape conventions (no payload leakage) for response bodies |
| `packages/server/src/static/serve.ts` | config | file-I/O | First static-file-serving code in the repo; use RESEARCH.md Pattern 1's `@fastify/static` + `setNotFoundHandler` block verbatim |
| `packages/cli/src/cli.ts` | CLI entry | process bootstrap | First CLI entry in the repo; use RESEARCH.md §Code Examples "Commander 15 CLI skeleton" verbatim, adapted with the `02-UI-SPEC.md` copy contract for banner/error output |
| `packages/cli/tsup.config.ts` | build config | batch | No build config exists yet; use RESEARCH.md §Code Examples "tsup.config.ts for the CLI bundle" verbatim, remembering `noExternal` for workspace packages (Pitfall 4) |
| `test/packaging/tarball-contents.test.ts` | test | batch | New test category (build-artifact assertion); no in-repo precedent, follow RESEARCH.md Pitfall 5 guidance |
| CLI banner/error/shutdown copy rendering (wherever implemented, e.g. `packages/cli/src/output.ts`) | utility | request-response (stdout) | No terminal-output module exists yet; must implement the exact copy strings and ANSI/`NO_COLOR`/`isTTY` degrade rules from `02-UI-SPEC.md` §Copywriting Contract and §Color — this is a locked contract, not a discretionary style choice |

## Metadata

**Analog search scope:** `packages/config-io/src/**`, `packages/schema-data/**`, `test/config-io/**`, `test/schema-data/**`, root `package.json`/`tsconfig.json`/`vitest.config.ts` (entire tracked codebase — no `packages/server`, `packages/cli`, or `test/server` directories exist yet)
**Files scanned:** 12 source files, 7 test files, 3 root config files
**Pattern extraction date:** 2026-07-12
