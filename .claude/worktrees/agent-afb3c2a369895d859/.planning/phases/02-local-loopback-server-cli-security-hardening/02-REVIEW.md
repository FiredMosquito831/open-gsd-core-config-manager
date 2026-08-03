---
phase: 02-local-loopback-server-cli-security-hardening
reviewed: 2026-07-13T00:00:00Z
depth: deep
files_reviewed: 26
files_reviewed_list:
  - packages/cli/src/bootstrap.ts
  - packages/cli/src/cli-main.ts
  - packages/cli/src/cli.ts
  - packages/cli/src/output.ts
  - packages/server/src/api-types.ts
  - packages/server/src/app.ts
  - packages/server/src/context.ts
  - packages/server/src/plugins/cors.ts
  - packages/server/src/plugins/host-guard.ts
  - packages/server/src/plugins/origin-guard.ts
  - packages/server/src/plugins/token-guard.ts
  - packages/server/src/registry.ts
  - packages/server/src/routes/configs.ts
  - packages/server/src/routes/health.ts
  - packages/server/src/schema.ts
  - packages/server/src/snapshot-store/index.ts
  - packages/server/src/snapshot-store/paths.ts
  - packages/server/src/snapshot-store/save-with-snapshot.ts
  - packages/server/src/static/serve.ts
  - scripts/build-client.mjs
  - test/packaging/tarball-contents.test.ts
  - test/server/api-routes.test.ts
  - test/server/cli-launch.test.ts
  - test/server/helpers/spawn-cli.ts
  - test/server/security.test.ts
  - test/server/snapshot-store.test.ts
  - test/server/teardown.test.ts
  - web/index.html
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-13T00:00:00Z
**Depth:** deep
**Files Reviewed:** 26
**Status:** issues_found

## Summary

This phase builds the loopback HTTP server, its four security guards (host/origin/CORS/token), the config registry (sole path-traversal boundary), the snapshot-store, and the CLI bootstrap/teardown lifecycle. The core browser-threat-model defenses (`host-guard.ts`, `origin-guard.ts`, `token-guard.ts`, `cors.ts`) are well-reasoned and internally consistent: Host is checked at root scope (covers static assets), Origin rejection is a real server-side 403 (not just an omitted CORS header), the token comparison is constant-time and fails closed on an unsealed context, and `registry.ts` genuinely is the only place a raw filesystem path is ever accepted from a client. I traced the CSRF/no-cors/simple-form-POST cases from the security brief and could not find a bypass: any request that omits the custom `x-gsd-token` header (which no-cors/simple requests cannot set) is rejected regardless of Origin, and any cross-origin request that does carry a matching preflight is still rejected by the dedicated `origin-guard.ts` 403 hook, not merely by an omitted CORS header.

However, three genuine BLOCKER-class problems surfaced by tracing call chains across files (config-io's `load()`/`atomic-write.ts` into `routes/configs.ts`, and `save-with-snapshot.ts` into `snapshot-store/index.ts`):

1. Every non-`ENOENT` filesystem error (permission errors, JSON-parse failures, disk-full, etc.) propagates uncaught out of the route handlers to Fastify's default error handler, which echoes `error.message` verbatim in the HTTP response body — and several of the underlying error messages (`load.ts`'s JSON-parse guard, raw Node `fs` errors) embed the absolute filesystem path. This directly violates the project's own repeatedly-stated Information-Disclosure guard (T-02-19/T-02-25).
2. The brand-new-config "pre-touch empty stub file" workaround in `save-with-snapshot.ts` has no rollback: if the very first save to a new path fails validation (or any other `saveConfig` step), a permanent 0-byte file is left behind where none existed before, and that stray file then causes a *second*, cascading uncaught-error path (feeding directly into finding #1) the next time it's read.
3. Snapshot recording (`snapshot-store/index.ts#recordSnapshot`) has zero locking, and the "does this config already exist" read in `save-with-snapshot.ts` happens *before* `saveConfig`'s advisory lock is acquired. Two concurrent saves to the same tracked config (e.g. two browser tabs on the same file) can silently drop an entire save from version history, or race on `index.json`'s `seq` counter — undermining exactly the "full version history" guarantee this feature exists to provide.

## Critical Issues

### CR-01: Uncaught filesystem/parse errors leak absolute paths back to the client

**File:** `packages/server/src/routes/configs.ts:77-88` (GET), `packages/server/src/routes/configs.ts:90-112` (PUT), `packages/server/src/app.ts` (no `setErrorHandler` anywhere in the app)

**Issue:** `GET /api/configs/:id` only catches `ENOENT`:
```ts
try {
  const data = await load(tracked.path, { schema: getBundledSchema() });
  return { ok: true, data };
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
    return reply.code(404).send(errBody('Unknown tracked config id'));
  }
  throw err;   // <-- everything else propagates
}
```
`load()` (`packages/config-io/src/load.ts:37-45`) explicitly interpolates the absolute path into a thrown `Error` on a JSON-parse failure:
```ts
throw new Error(`Failed to parse ${kind} JSON at path: ${absPath}`);
```
and any other `readFileSync` failure (EACCES, EISDIR, etc.) throws Node's own fs error, whose `.message` also embeds the path (e.g. `"EACCES: permission denied, open 'C:\Users\...\config.json'"`).

`buildApp()` never registers `app.setErrorHandler(...)`, so any error that reaches Fastify's default handler is serialized as `{ statusCode: 500, error: 'Internal Server Error', message: err.message }` — `err.message` (containing the absolute path) is sent straight back to the calling browser tab. The same holds for the `PUT /api/configs/:id` path: `saveWithSnapshot` only intercepts `ValidationError`; any other thrown error (a write failure inside `saveConfig`, or a non-ENOENT error from the wrapper's own `readFile`) rethrows uncaught to the same default handler.

This is exactly the failure mode `registry.ts` and `snapshot-store/index.ts` go out of their way to avoid (their own module docs explicitly call out "never interpolate the rejected path into the error message" as an Information Disclosure guard) — but that discipline is not enforced at the boundary where these frozen/composed calls actually leave the process.

**Fix:** Add a project-wide `setErrorHandler` in `app.ts` that maps any *unexpected* error to a fixed, static `ApiErr` body (never `err.message`) and a generic 500, e.g.:
```ts
app.setErrorHandler((err, req, reply) => {
  // Fastify route-schema validation errors are safe/expected — pass through.
  if (err.validation) {
    return reply.code(400).send({ ok: false, errors: [{ message: 'Invalid request body' }] });
  }
  return reply.code(500).send({ ok: false, errors: [{ message: 'Internal error' }] });
});
```
and/or wrap the `load()` call in `configs.ts` to catch every error class it can throw and re-throw a path-free error before it reaches Fastify.

---

### CR-02: New-config validation failure leaves a permanent stray 0-byte file with no cleanup

**File:** `packages/server/src/snapshot-store/save-with-snapshot.ts:79-97`

**Issue:**
```ts
try {
  priorContent = await readFile(configPath, 'utf8');
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
    priorContent = null;
    await writeFile(configPath, '', { flag: 'wx' }).catch((touchErr) => {
      if ((touchErr as NodeJS.ErrnoException).code !== 'EEXIST') throw touchErr;
    });
  } else {
    throw err;
  }
}
```
This stub file is created unconditionally whenever the target path does not yet exist, *before* it is known whether `saveConfig` will actually succeed. If the subsequent `saveConfig` call throws a `ValidationError` (schema validation failure on a brand-new config), `saveWithSnapshot` catches it and returns `{ ok: false, errors }` — but the stub file it just created on disk is never removed. The route's own doc comment (`routes/configs.ts:16-19`) claims "the on-disk file is guaranteed byte-unchanged in that case" — true only for a *pre-existing* file; for a brand-new path the file state silently changes from "does not exist" to "exists, empty", with no signal to the caller and no test covering this path (`test/server/snapshot-store.test.ts`'s validation-failure case only exercises an already-existing config).

This also cascades into CR-01: a subsequent `GET /api/configs/:id` for that same tracked id now succeeds in *finding* the file but fails to `JSON.parse('')`, throwing the path-embedding error described in CR-01 instead of continuing to behave like "nothing has been saved yet."

**Fix:** Track whether the stub was actually created by this call, and unlink it in a `catch` around the `saveConfig` step when the save did not succeed:
```ts
let stubCreated = false;
// ... during the ENOENT branch:
await writeFile(configPath, '', { flag: 'wx' }).then(() => { stubCreated = true; }).catch(...);
...
try {
  await saveConfig(configPath, nextConfig, validate);
} catch (err) {
  if (stubCreated) await unlink(configPath).catch(() => undefined);
  if (err instanceof ValidationError) return { ok: false, errors: err.errors };
  throw err;
}
```

---

### CR-03: Concurrent saves to the same tracked config can silently lose a version-history entry

**File:** `packages/server/src/snapshot-store/save-with-snapshot.ts:79-123`, `packages/server/src/snapshot-store/index.ts:92-115`

**Issue:** The "read prior content" step in `saveWithSnapshot` (line 82-97) runs *before* `saveConfig` acquires its `proper-lockfile` advisory lock, and `recordSnapshot`'s own `readIndex` → compute `seq` → `writeFile(index.json)` sequence (lines 102-110 of `snapshot-store/index.ts`) runs entirely *after* that lock has already been released. Neither window is serialized by any lock:

- Two concurrent `PUT /api/configs/:id` requests for the *same* tracked config both call `readFile(configPath)` before either has written anything, so both capture the same `priorContent`. `saveConfig`'s lock then serializes the two actual writes (request A's write, then request B's write) — but request B's `recordSnapshot` call still snapshots the *pre-both-requests* content, not what request A just wrote. Request A's saved version is never recorded anywhere and is unrecoverable via version history, even though the on-disk file briefly held it.
- `recordSnapshot` itself has no lock around its own `readIndex`/`seq` computation/`index.json` rewrite. Two overlapping `recordSnapshot` calls (plausible any time two saves to the same config land close together) can read the same last `seq`, both write `<seq+1>.json` (one silently clobbering the other's snapshot content), and race on the final `index.json` write, potentially dropping one of the two new entries entirely.

This is a real data-loss path for the exact feature (SAVE-04 / full version history) this phase's threat model calls out for TOCTOU scrutiny, and it is reachable by an entirely benign, expected usage pattern (the same config open in two browser tabs), not just an adversarial one.

**Fix:** Serialize snapshot recording per config path — e.g. an in-process mutex/queue keyed by the resolved config path (a `Map<string, Promise<void>>` chaining each `saveWithSnapshot` call for the same path), or extend the existing `proper-lockfile` lock's scope to cover the read-prior-content → save → record-snapshot sequence as a single critical section rather than only the write inside `saveConfig`.

## Warnings

### WR-01: `/api/health` always reports version `0.0.0` in the packaged/npx artifact

**File:** `packages/server/src/routes/health.ts:16-24`

**Issue:** `readPackageVersion()` resolves `package.json` via a hardcoded four-level walk from `import.meta.url`:
```ts
const pkgPath = join(__dirname, '..', '..', '..', '..', 'package.json');
```
This is correct only under the from-source layout. `bootstrap.ts`'s `defaultClientRoot()` explicitly documents and works around the identical landmine (tsup inlines this module's code into `dist/cli.js`, so at runtime `import.meta.url`/`__dirname` resolves inside `dist/`, not `packages/server/src/routes/`) — but `health.ts` has no equivalent bundled-vs-source branching. In the published/`npx`-run artifact, the walk lands outside the installed package, `readFileSync` throws, the `catch` swallows it, and the version falls back to the hardcoded `'0.0.0'` on every real install. `test/packaging/tarball-contents.test.ts`'s extracted-tarball smoke run only checks `healthBody.ok === true`, never the version value, so this regression is currently invisible to the suite.

**Fix:** Mirror `bootstrap.ts`'s pattern — try the bundled-sibling location first (e.g. a package.json copied next to `dist/cli.js`, or read a version string inlined at build time via a JSON module import like `schema.ts` already does for the bundled schema), falling back to the from-source walk only if that fails.

---

### WR-02: `registry.ts#track()` never re-validates a path after tracking, and the resulting fs errors leak paths

**File:** `packages/server/src/registry.ts:75-83`

**Issue:** `track()` validates that the path is a regular file *at track time only* (and only if it happens to exist yet — a not-yet-existing path is accepted, by design, for "create new config"). Nothing re-checks this at `GET`/`PUT` time. If the path is later replaced by a directory or other non-regular file (or simply becomes permission-denied), the resulting Node fs error surfaces through the exact uncaught path described in CR-01, leaking the absolute path back to the caller.

**Fix:** Once CR-01 is fixed generically (sanitized error handler), this stops being an information-disclosure issue on its own, but consider re-stat'ing at `GET`/`PUT` time and returning the same static "Unknown tracked config id"-style message for a config that no longer resolves to a regular file, rather than relying solely on the generic error handler to catch it.

---

### WR-03: `web/index.html` renders a server-supplied field via `innerHTML`

**File:** `web/index.html:72-75`, `103-110`

**Issue:**
```js
function setStatus(html, cls) {
  statusEl.className = cls || "";
  statusEl.innerHTML = html;
}
...
var version = body.version ? " (v" + body.version + ")" : "";
setStatus("Connected to the local helper" + version + ".", "ok");
```
`body.version` originates from the `/api/health` response (ultimately `package.json`'s `version` field), so today this is not attacker-reachable. But it is a value that arrived over an HTTP response body being concatenated straight into `.innerHTML`, which is exactly the pattern that becomes an XSS vector the moment a future phase reuses this bootstrap page's pattern for a less-trusted server-echoed field (e.g. a filename or path in a later status message).

**Fix:** Use `textContent` for the dynamic portion, or build the status via DOM nodes instead of an HTML string, e.g. `statusEl.textContent = 'Connected to the local helper' + version + '.'`.

---

### WR-04: `scripts/build-client.mjs` ships everything under `web/` into the tarball with no allow/deny filter

**File:** `scripts/build-client.mjs:33-35`

**Issue:**
```js
rmSync(outDir, { recursive: true, force: true });
cpSync(srcDir, outDir, { recursive: true });
```
Harmless today since `web/` contains only `index.html`, but there is no filter preventing a future stray dev artifact (a `.env`, an editor backup file, a source map) placed under `web/` from being copied verbatim into `dist/client` and then shipped in the published npm tarball via `test/packaging/tarball-contents.test.ts`'s "ships no source/test/planning artifacts" check — which only excludes `web/` itself, not files that get *copied out of* `web/` into `dist/client`.

**Fix:** When Phase 3 replaces this with a real Vite build (per this file's own header comment), ensure the build's `outDir` output is scoped to the actual bundled assets. Until then, consider an explicit allowlist of file extensions/names to copy rather than a blanket recursive copy.

## Info

### IN-01: Unmatched exact `/api` path falls through to the HTML SPA shell instead of a JSON 404

**File:** `packages/server/src/static/serve.ts:31-33`

**Issue:** `isApiPath()` checks `req.url.startsWith('/api/')` (with a trailing slash). A request to exactly `/api` (no trailing slash, no further segments) does not match, so the not-found handler serves the SPA `index.html` instead of the JSON `{ ok: false, errors: [...] }` envelope every other unmatched API-ish path gets. Harmless (no real client ever requests bare `/api`), but inconsistent with the stated intent that "an unmatched `/api/*` path" never gets an HTML response.

**Fix:** `req.url === '/api' || req.url.startsWith('/api/')`.

---

### IN-02: `registry.ts#nameFor()` produces an empty display name for a root-level config path

**File:** `packages/server/src/registry.ts:56-58`

**Issue:** `nameFor()` computes `${basename(dirname(resolvedPath))}/${basename(resolvedPath)}`. For a path like `C:\config.json` or `/config.json` (parent is the filesystem root), `dirname()` returns the root itself and `basename()` of that is an empty string, producing a display name like `/config.json` with a leading empty segment (`"" + "/" + "config.json"`). Purely cosmetic (Phase 3 sidebar label), not a security or data-safety issue.

**Fix:** Fall back to a fixed label (e.g. the drive/root itself) when `basename(dirname(...))` is empty.

---

_Reviewed: 2026-07-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
