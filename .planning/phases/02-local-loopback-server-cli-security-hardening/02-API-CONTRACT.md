# 02-API-CONTRACT.md — Frozen Config REST API Contract

**Status: FROZEN.** Phase 3's UI and Phase 5's version-history UI build directly against this document. Changing a route shape, envelope, or status code after this plan lands is a breaking-change cost for those phases — treat any change as an architectural decision (deviation Rule 4), not a routine edit.

Source of truth for the TypeScript shapes: `packages/server/src/api-types.ts`. This document is the human-readable mirror of that file plus the route table.

## Authentication

Every `/api/*` route — **reads included** (D-04, stricter than the literal SEC-02 wording, which only names mutations) — requires the `x-gsd-token` header, set to the per-launch token minted by the CLI (`crypto.randomUUID()`, D-05). The token is embedded once in the auto-opened URL's `?t=` query string; the client reads it once and attaches it to every subsequent `/api` request.

A request to any `/api/*` route without a valid `x-gsd-token` — or with a Host/Origin outside the loopback allowlist — is rejected before any route handler runs (SEC-01, SEC-02).

## Envelope Shapes

Every API response is exactly one of two shapes.

### Success — `ApiOk<T>`

```ts
type ApiOk<T = Record<string, never>> = { ok: true } & T;
```

`T` is the route-specific payload merged alongside `ok: true`. Example: `{ ok: true, configs: [...] }`.

### Error — `ApiErr`

```ts
interface ApiErr {
  ok: false;
  errors: Array<{ message: string; [k: string]: unknown }>;
}
```

`errors` is always a non-empty array. For a 422 (schema-validation failure) it carries the raw Ajv field errors; for every other error status it carries a single fixed, static `message` string that **never** interpolates request-supplied values (host, origin, token, path, or config content) — an Information Disclosure guard verified by the security and API-route test suites.

## Status-Code Map

| Code | Meaning | Routes |
|------|---------|--------|
| 200  | Success | all routes |
| 400  | Malformed request body, or a `track` path rejected by the registry (non-absolute, non-`.json`, or not a regular file) | `POST /api/configs/track` |
| 403  | Host allowlist, Origin guard, or token guard rejection — fires before any route handler runs | every `/api/*` route |
| 404  | Unknown tracked-config id | `GET /api/configs/:id`, `PUT /api/configs/:id` |
| 422  | Schema-validation failure on save — the write did not happen | `PUT /api/configs/:id` |
| 500  | Unexpected server error | any route |

## Routes

### `GET /api/health`

Already built in Plan 04. Token-guarded.

**Response 200:**
```json
{ "ok": true, "name": "gsd-config-manager", "version": "0.0.0", "pid": 12345 }
```

### `GET /api/configs`

Lists every config currently tracked in the server's in-memory registry.

**Response 200:**
```json
{ "ok": true, "configs": [ { "id": "…", "path": "…", "name": "myproject/config.json" } ] }
```

### `POST /api/configs/track`

The **only** route that accepts a client-supplied filesystem path — this is the entire path-traversal boundary (T-02-05). The registry validates the path (must be absolute, must resolve to a `.json` basename, must not exist-as-non-regular-file) and mints (or returns the pre-existing) opaque `id`. Tracking the same path twice returns the same `id` and does not duplicate the entry.

**Request body:**
```json
{ "path": "/absolute/path/to/config.json" }
```

**Response 200:**
```json
{ "ok": true, "config": { "id": "…", "path": "…", "name": "myproject/config.json" } }
```

**Response 400** (rejected path — the rejection message is always a fixed static string, never the submitted path):
```json
{ "ok": false, "errors": [{ "message": "Config path must be an absolute path" }] }
```

### `GET /api/configs/:id`

Loads a tracked config by its opaque id — the server resolves `id` to its own validated path via the registry; the client never supplies or sees a raw filesystem path here. Delegates to Phase 1's frozen `load(path, { schema })`, with the bundled schema passed explicitly (see `packages/server/src/schema.ts` — never `load()`'s `import.meta.url`-relative default).

**Response 200:**
```json
{ "ok": true, "data": { "raw": { "project": {}, "global": {} }, "effective": {}, "unknown": [], "meta": { "globalDefaultsPath": "…", "globalDefaultsFound": true } } }
```

`data` is Phase 1's frozen `LoadResult` (`raw`, `effective`, `unknown`, `meta`) passed through unchanged.

**Response 404** (unknown id, or the tracked file has been deleted out from under the registry):
```json
{ "ok": false, "errors": [{ "message": "Unknown tracked config id" }] }
```

### `PUT /api/configs/:id`

The **only write path** in the entire API. Resolves `id` through the registry (404 if unknown), then calls `saveWithSnapshot(path, config, validator, { root, warn })` (Plan 02) — never calls `saveConfig` or touches the filesystem directly. This is how SAVE-04 (pre-write snapshot with no extra user action) and SAVE-01 (validate-blocks-write) are both satisfied end to end over HTTP.

**Request body:**
```json
{ "config": { "...": "the full candidate config object" } }
```

Any other property on the body (e.g. a client-supplied `path`) is ignored — the route never reads a path from the request body.

**Response 200** (save succeeded):
```json
{ "ok": true, "snapshotId": "…" }
```

`snapshotId` is omitted on a first-ever save (nothing to snapshot, D-11). A non-fatal snapshot-recording failure (D-12) still returns 200 with a `warning` string instead of `snapshotId` — the save has already committed and is never rolled back for a history-recording failure:
```json
{ "ok": true, "warning": "Saved successfully, but history was not recorded (…). Your changes are safe; version history for this save is unavailable." }
```

**Response 404** (unknown id):
```json
{ "ok": false, "errors": [{ "message": "Unknown tracked config id" }] }
```

**Response 422** (schema-validation failure — the write did NOT happen, the on-disk file is byte-unchanged):
```json
{ "ok": false, "errors": [ { "instancePath": "/mode", "keyword": "enum" } ] }
```

`errors` here is the raw Ajv `ErrorObject[]` array from `saveWithSnapshot`'s `SaveResult`.

## Phase 3 / Phase 5 Extension Points

Deliberately absent from this frozen surface — named here so later phases know exactly what to add without re-litigating this contract:

- **Snapshot list / read / revert routes** → Phase 5 (SAVE-05, SAVE-06). Revert must re-enter through `PUT /api/configs/:id` → `saveWithSnapshot` (D-10: revert-as-write, no special-case path) rather than writing the file directly.
- **Registry persistence across sessions** → Phase 3 (DISC-02). The registry is currently a pure in-memory `Map` seeded only by `track()` calls during the current process lifetime; `createRegistry()` is a factory specifically so Phase 3 can hand it a persisted seed without restructuring it.
- **Folder scan for auto-discovery** → Phase 3 (DISC-03). Not present in this phase at all; when added, discovered paths still flow through the same `track()` validation, never bypass it.
