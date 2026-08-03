# Phase 2: Local Loopback Server, CLI & Security Hardening - Research

**Researched:** 2026-07-12
**Domain:** Local loopback HTTP server (Fastify 5) + CLI launcher (Commander 15) + npm packaging + filesystem snapshot store, for an `npx`-launched desktop-grade tool on Windows 11
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Launch & server stack**
- **D-01: Fastify + Commander (locked stack).** Resolve the CLAUDE.md-vs-research conflict in favor of CLAUDE.md's stack table: **Fastify 5** for the server (built-in Ajv route validation reusing the project's Ajv, `@fastify/static` for the bundled SPA, `@fastify/cors` for Origin locking) + **Commander 15** for CLI flag parsing (`--port`, `--no-open`, `--scan/--dir`). Chosen over the research ARCHITECTURE.md "minimal node:http + no CLI framework" sketch — the user wants the robust, schema-validated server the stack was researched around.
- **D-02: OS-assigned ephemeral port.** Bind with `listen(0, '127.0.0.1')`, read the assigned port back from `server.address()`, then print/open the URL. No `get-port` dependency, zero collision handling needed. (Research's own sketch uses this.)
- **D-03: SIGINT/SIGTERM handler for clean teardown; no single-instance lock.** Register signal handlers that close the HTTP server and release any `proper-lockfile` locks, then exit — satisfying success criterion 3 (port released, no orphan process or lock file). **No** single-instance enforcement: a second `npx` launch simply gets its own ephemeral port.

**Security model (SEC-01, SEC-02)**
- **D-04: Token guards ALL API requests (reads + writes), not just mutations.** Stronger than the literal SEC-02 wording — closes read-side info leaks to other local tabs. **Static assets** (the bootstrap HTML/JS) stay unguarded so the browser can load the SPA.
- **D-05: Token flow = URL `?t=<token>` → SPA reads query param once → sends `x-gsd-token` header on every API `fetch`.** Open `http://127.0.0.1:PORT/?t=<token>`; the SPA keeps the token in memory and attaches it as a **header** (not a query param) on API calls so it never lands in server request logs. Per-launch random token via `crypto.randomUUID()`.
- **D-06: Both Host-allowlist AND Origin/CORS checks.** Reject requests whose `Host` header isn't in the loopback allowlist (`127.0.0.1:PORT`, `localhost:PORT`) — DNS-rebinding defense — **and** reject cross-origin requests via an Origin/Referer check (`@fastify/cors` locked to the loopback origin). Belt-and-suspenders per CLAUDE.md "What NOT to use"; success criterion 2 tests both the Host-header and cross-origin cases.

**Snapshot store (SAVE-04)**
- **D-07: Store in the OS-conventional per-user app-data dir (env-paths style), never inside the tracked project or its `.git`.** Windows `%APPDATA%`, `*nix` XDG/`~/.local/share` / macOS `~/Library`. One **path-hashed subfolder per tracked config**. (Research §Data Ownership: app-owned dir, never in a tracked project.)
- **D-08: Full-JSON snapshots + `index.json` per config.** One full JSON file per snapshot (KB-scale configs — cheap), plus an `index.json` listing entries. Diff/revert computed **on-demand** in Phase 5. Chosen over a diff-chain to avoid reconstruction/chain-corruption risk on a data-safety-critical tool (research §Pattern 4).
- **D-09: Design the index for pruning/de-dupe now.** Bake **sequence number + timestamp + content hash** into every `index.json` entry from day one, so keep-last-N / keep-milestones pruning and skip-identical-save de-dupe can be added later **without an on-disk format migration** (research §Scale flags unbounded history as the likely future friction). Pruning UI itself is out of scope for this phase.

**Snapshot pipeline integration (SAVE-04, builds on Phase 1)**
- **D-10: Server-layer `saveWithSnapshot()` wrapper — Phase 1's frozen `saveConfig` stays untouched.** The wrapper orchestrates: read current on-disk content → call `saveConfig` (unchanged) → on success, record the snapshot. Snapshotting is a **server concern**, not a change to the frozen `config-io` barrel. Phase 5's revert must reuse this same wrapper (revert-as-write, no special-case path).
- **D-11: Pre-write snapshot of the CURRENT on-disk content** (research §Pattern 4: "snapshot BEFORE overwrite"). History = every prior state; revert restores a known-good past. The **first-ever save of a brand-new file** has nothing to snapshot — skip gracefully (no phantom entry).
- **D-12: Snapshot failure is non-fatal.** The config write is the user's actual intent and the source of truth. If snapshot recording fails (e.g. app-data disk error), the **save still commits** and the API surfaces a non-blocking "history not recorded" warning. History bookkeeping must never block a valid save.

### Claude's Discretion

- **REST API route shape** the Phase 3 UI will call (list/load/save/track endpoints, response envelope like `{ ok, snapshotId, errors }`) — design deliberately since Phase 3 builds against it, but the specific route naming is open.
- **Dev-vs-prod static serving** — how `@fastify/static` serves the built Vite `dist/client` in production vs. proxying Vite's dev server in development.
- **UI-bundling mechanics for DIST-03** — Phase 3 builds the actual screens, so Phase 2 establishes the packaging pipeline (`bin` + shebang, `tsup` for the CLI, `files`/`npm pack --dry-run` verification, `dist/client` inclusion). A placeholder/minimal served page is acceptable for Phase 2 verification.
- **Exact env-paths / app-data library choice** (e.g. `env-paths`) and path-hashing scheme (e.g. sha256 of the absolute config path) — pick a standard, cross-platform approach.

### Deferred Ideas (OUT OF SCOPE)

- **Single-instance / focus-existing-instance UX** (detect a running launch in the same project and reuse it) — explicitly declined for Phase 2 (D-03); could revisit as a later polish item if double-launch becomes a real annoyance.
- **Snapshot pruning/compaction UI** (keep-last-N, keep-milestones) — index format is designed to support it now (D-09), but the pruning feature itself is future work (Phase 5+ / a later milestone).
- **Version-history browse / diff / revert** — Phase 5 (SAVE-05, SAVE-06). Phase 2 only builds the store + pre-write snapshot pipeline it sits on.
- **The actual schema-driven UI screens** — Phase 3. Phase 2 provides only the server, security, packaging pipeline, and (at most) a placeholder served page.

None of the above are in Phase 2 scope — discussion stayed within phase boundary.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIST-01 | User can launch the tool with a single command (`npx <package>`) with no separate server setup | `bin` + shebang packaging pattern (§Architecture Patterns → Pattern 7); Commander 15 CLI skeleton (§Code Examples) |
| DIST-02 | The tool starts a local loopback (127.0.0.1) helper and automatically opens the UI in the user's browser | `listen({port:0, host:'127.0.0.1'})` + `server.address()` readback (§Pattern 4); `open` package + WSL/headless fallback (§Common Pitfalls) |
| DIST-03 | The tool is installable/shareable as a public npm package with the built UI bundled inside it | `tsup` CLI bundling + `files` field + `npm pack --dry-run` verification (§Pattern 7, §Code Examples) |
| DIST-04 | User can stop the tool cleanly (Ctrl-C) and the local helper shuts down without leaving orphaned processes or lock files | Awaited `fastify.close()` + `proper-lockfile` release-on-exit + Windows signal caveats (§Pattern 5, §Common Pitfalls, §Environment Availability) |
| SEC-01 | The local helper binds only to 127.0.0.1 and rejects requests whose Host header is not in an explicit allowlist (DNS-rebinding protection) | Host-header allowlist hook pattern (§Pattern 1); DNS-rebinding precedent from MCP Inspector CVE-2025-49596 (§Common Pitfalls, §Security Domain) |
| SEC-02 | Mutating (write) requests require a per-launch random token embedded in the opened URL; requests without it are rejected | Token generation via `crypto.randomUUID()` + `x-gsd-token` header guard scoped to `/api/*` (§Pattern 1, §Pattern 2) |
| SAVE-04 | Every save creates a version snapshot stored outside the tracked project directory | `env-paths` app-data resolution + path-hashed subfolder + `index.json` (seq/timestamp/hash) + `saveWithSnapshot()` wrapper composing Phase 1's frozen `saveConfig` (§Pattern 6, §Code Examples) |
</phase_requirements>

## Summary

Phase 2 wraps Phase 1's frozen `config-io` package in three layers: a Fastify 5 HTTP server bound strictly to `127.0.0.1`, a Commander 15 CLI launcher that boots that server and opens the browser, and a filesystem-based snapshot store that hooks into every successful save. The security model is well-precedented — this is exactly the shape of MCP Inspector (post-CVE-2025-49596 fix), Jupyter Notebook, and Prisma Studio: bind loopback-only, validate the `Host` header against an explicit allowlist (defeats DNS rebinding because a browser cannot forge `Host`), lock CORS to the exact computed origin, and require a per-launch random token on every API call. All three defenses are independent and layered — a browser cannot forge `Host` but *can* be tricked into cross-origin `fetch()`, hence CORS; CORS can be bypassed by non-browser clients (curl, other localhost processes), hence the token.

The riskiest *implementation* detail (not a design question — D-01 through D-12 already answered the design questions) is **Fastify hook scoping**: the token guard and Host allowlist must run on `/api/*` routes but explicitly **not** on the static asset routes serving the SPA's `index.html`/JS bundle, because the browser has no token until it has loaded and parsed that HTML. Fastify's encapsulation model (a hook registered inside a `fastify.register(plugin, {prefix: '/api'})` call only fires for routes inside that plugin) is the standard mechanism for this — confirmed by both Fastify's own docs and the `@fastify/auth` plugin's documented scope semantics.

The second risk area is **process lifecycle correctness on Windows** (the confirmed target platform): `fastify.close()` must be **awaited**, not fire-and-forget, or the process can exit before the port is actually released; `proper-lockfile` releases locks automatically on graceful exit but does **not** protect against `SIGKILL`/hard-kill, and Windows' signal delivery to Node processes is less reliable than POSIX SIGTERM/SIGINT — this must be verified with an actual spawned-process test on the target platform, not assumed from POSIX-only testing.

**Primary recommendation:** Build the server as an encapsulated Fastify plugin tree — an unguarded root scope serving static assets via `@fastify/static` + a `setNotFoundHandler` SPA fallback, and a `/api` prefixed child plugin carrying both the Host-allowlist `onRequest` hook and the token-check `onRequest` hook — bootstrapped by a thin Commander 15 CLI that binds `listen({port:0, host:'127.0.0.1'})`, reads the assigned port from `server.address()`, opens `http://127.0.0.1:<port>/?t=<token>` via `open`, and registers `SIGINT`/`SIGTERM` handlers that `await fastify.close()` before `process.exit(0)`.

## Architectural Responsibility Map

This tool is a single local process (no browser/SSR/CDN split); the table below maps the 5 standard tiers onto this project's actual architecture, extending with a **CLI/Launcher** sub-tier and a **Packaging/Distribution** sub-tier since neither maps cleanly onto Browser/SSR/CDN.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Process bootstrap, flag parsing (`--port`, `--no-open`, `--scan`) | CLI/Launcher (extension of API/Backend) | — | Pure process-startup concern; owns nothing at request time |
| HTTP server bind (`127.0.0.1`, ephemeral port) | API/Backend | — | The Local Node Service is the sole owner of the listening socket |
| Static SPA asset serving (`dist/client`) | API/Backend | CDN/Static (conceptually) | No real CDN exists — the same local server plays the "static asset host" role, but it is one Fastify instance, not a separate tier |
| Per-launch token generation + guard | API/Backend | — | Token is minted and checked entirely server-side; browser only carries it |
| Host-header allowlist / CORS origin lock | API/Backend | — | Defends the server's own socket; not a browser-side concern |
| Browser auto-launch | CLI/Launcher | — | One-shot side effect of process startup, not a request-time concern |
| Process signal handling / teardown | CLI/Launcher | API/Backend | CLI owns signal registration; it delegates the actual `fastify.close()` + lock release to the server/snapshot modules |
| Snapshot store (files + `index.json`) | Database/Storage | — | Filesystem-as-database; owns its own directory layout, independent of request handling |
| `saveWithSnapshot()` orchestration | API/Backend | Database/Storage | Lives in the server layer (it is the thing that decides *when* to snapshot) but calls into the Storage tier's snapshot-recording primitive |
| REST API route contract (list/load/save/track) | API/Backend | — | The frozen surface Phase 3's browser tier will consume; no routes are UI-aware |
| npm packaging (`bin`, `tsup`, `files` field) | Packaging/Distribution (extension) | — | Build-time concern, not a runtime tier — included because DIST-03/04 require verifying it explicitly |

**Why this matters for planning:** every capability above resolves to the CLI or the Local Node Service — there is **no browser-tier code in this phase** (per CONTEXT.md: "No UI screens are built here"). Any task that proposes writing browser-side JS beyond a placeholder static page is out of tier for Phase 2 and belongs in Phase 3.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | **5.10.0** [VERIFIED: npm registry] | Local loopback HTTP server | CLAUDE.md-locked (D-01); built-in Ajv route validation reuses Phase 1's Ajv instance; radix-tree routing; encapsulated-plugin hook scoping is the exact mechanism needed for the "/api guarded, static unguarded" requirement |
| `commander` | **15.0.0** [VERIFIED: npm registry] | CLI flag parsing (`--port`, `--no-open`, `--scan/--dir`) | CLAUDE.md-locked (D-01); zero runtime deps, `--no-*` negatable-boolean support built in [CITED: github.com/tj/commander.js] |
| `@fastify/static` | **10.1.0** [VERIFIED: npm registry] | Serves the bundled Vite `dist/client` SPA | Purpose-built plugin; supports `setNotFoundHandler` + `reply.sendFile('index.html')` SPA-fallback pattern [CITED: github.com/fastify/fastify-static] |
| `@fastify/cors` | **11.3.0** [VERIFIED: npm registry] | Locks CORS to the exact computed loopback origin | Function-based `origin` callback with an explicit allowlist `Set` is the documented, security-conscious pattern (avoids reflection exploits) [CITED: github.com/fastify/fastify-cors] |
| `open` | **11.0.0** [VERIFIED: npm registry] | Auto-launches the default browser after bind | CLAUDE.md-locked; native ESM only (no CJS export) — must be `import()`ed or the whole CLI entry must be ESM [CITED: npmjs.com/package/open] |
| `write-file-atomic` | **7.0.1 (pinned)** [VERIFIED: npm registry — frozen Phase 1 dependency, do not float to `^8`] | Atomic config writes | Already the mechanism inside Phase 1's frozen `saveConfig`; Phase 2 does not touch this, it only calls `saveConfig` |
| `proper-lockfile` | **4.1.2** [VERIFIED: npm registry — frozen Phase 1 dependency] | Advisory locking, reused for teardown | Already a dependency; SIGINT/SIGTERM handler (D-03) must release any locks it holds before exit |
| `ajv` / `ajv-formats` | **8.20.0 / 3.0.1** [VERIFIED: npm registry — frozen Phase 1 dependency] | Fastify route schema validation, reusing Phase 1's validator | Fastify 5 uses Ajv 8 internally — no duplicate/conflicting Ajv instance in `node_modules` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsup` | **8.5.1** [VERIFIED: npm registry] | Bundles the Node CLI/server TS entry into `dist/cli.js` | CLAUDE.md-locked; auto-preserves shebangs and auto-`chmod +x`s the output on POSIX; auto-externalizes `dependencies`/`peerDependencies` from `package.json` [CITED: tsup docs / github.com/egoist/tsup] — **note:** tsup itself is in maintenance mode per its own README (recommends `tsdown` for new projects); still the correct choice here since it is CLAUDE.md-locked and the project is not starting from zero |
| `env-paths` | **4.0.0** [VERIFIED: npm registry] | Cross-platform per-user app-data directory resolution (snapshot store root) | Claude's-discretion pick for D-07; returns `{data, config, cache, log, temp}` paths following OS convention (Windows `%LOCALAPPDATA%`/`%APPDATA%`, XDG on Linux, `~/Library` on macOS); does **not** create the directory — caller must `fs.mkdir(..., {recursive:true})` [CITED: github.com/sindresorhus/env-paths] |
| `crypto` (Node built-in) | n/a | Per-launch token generation (`crypto.randomUUID()`) and content-hash for snapshot index (`crypto.createHash('sha256')`) | Never hand-roll token/hash generation; Node's built-in `crypto` module is the correct primitive per CLAUDE.md's "never hand-roll cryptography" posture |
| `node:http`'s `AddressInfo` type | n/a | Typing `server.address()` after `listen({port:0})` | Standard Node types; no extra package needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OS-assigned ephemeral port (`listen(0,...)`) | `get-port` | Declined by D-02 — zero collision handling needed with port 0; `get-port` would add a dependency for a problem the OS already solves |
| Awaited `fastify.close()` + manual `setTimeout` force-exit | `fastify-graceful-shutdown` plugin or `close-with-grace` | Both are third-party wrappers around the same primitive; `close-with-grace`'s default 500ms force-exit window is documented as dangerously short for even simple in-flight requests [CITED: github.com/fastify/fastify-cli issue #531] — hand-rolling the ~10-15 line awaited-close pattern is simpler and avoids an extra dependency plus its footgun default |
| Single-instance lock via a PID/lock file | `proper-lockfile`-based single-instance guard | Explicitly declined (D-03) — a second `npx` launch just gets its own ephemeral port; no cross-launch coordination needed |
| `env-paths` | `platform-folders` (native addon) | `platform-folders` uses a native C++ addon — adds install-time compilation risk for an `npx`-launched tool that must install instantly; `env-paths` is pure JS |

**Installation:**
```bash
npm install fastify @fastify/static @fastify/cors commander open env-paths
# already present from Phase 1: ajv, ajv-formats, proper-lockfile, write-file-atomic
npm install -D tsup
```

**Version verification:** All versions above were confirmed live against the npm registry on 2026-07-12 via `npm view <package> version`, matching CLAUDE.md's pinned stack table exactly (fastify 5.10.0, @fastify/static 10.1.0, @fastify/cors 11.3.0, commander 15.0.0, open 11.0.0, tsup 8.5.1, proper-lockfile 4.1.2, write-file-atomic — registry latest is 8.0.0 but this project pins **7.0.1** per CLAUDE.md's explicit "do not float to `^8`" directive, already reflected in the repo's `package.json`).

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----|-----------|-------------|---------|-------------|
| `fastify` | npm | latest ver. published 2026-07-05 | 9.5M | github.com/fastify/fastify | SUS ("too-new") | **Approved with note** — see below |
| `@fastify/static` | npm | latest ver. published 2026-07-11 | 3.1M | github.com/fastify/fastify-static | SUS ("too-new") | **Approved with note** — see below |
| `@fastify/cors` | npm | latest ver. published 2026-07-08 | 4.7M | github.com/fastify/fastify-cors | SUS ("too-new") | **Approved with note** — see below |
| `commander` | npm | published 2026-05-29 | 371M | github.com/tj/commander.js | OK | Approved |
| `open` | npm | published 2025-11-15 | 96.6M | github.com/sindresorhus/open | OK | Approved |
| `tsup` | npm | published 2025-11-12 | 6.7M | github.com/egoist/tsup | OK | Approved |
| `proper-lockfile` | npm | published 2021-01-25 | 15.2M | github.com/moxystudio/node-proper-lockfile | OK | Approved (frozen Phase 1 dep) |
| `env-paths` | npm | published 2026-01-24 | 78.0M | github.com/sindresorhus/env-paths | OK | Approved |

**Note on the three `SUS` verdicts (`fastify`, `@fastify/static`, `@fastify/cors`):** The legitimacy seam's "too-new" signal is measuring **recency of the latest published version**, not package age or trustworthiness — all three have multi-million-weekly-download counts, an official `github.com/fastify/*` source repo, no `postinstall` script, and are not deprecated. This pattern (very recent patch/minor releases on an extremely well-established package) is consistent with the Fastify team's normal release cadence, not a slopsquatting/typosquatting signal. These are also the exact package names/versions independently verified via direct npm registry queries in this project's own prior `STACK.md` research (2026-07-11, HIGH confidence) and explicitly locked in `CLAUDE.md`. **Per the Package Legitimacy Gate protocol, the SUS disposition is kept regardless of this context** — the planner MUST insert a `checkpoint:human-verify` task immediately before the `npm install fastify @fastify/static @fastify/cors` step, so a human confirms the installed version matches the expected publisher/repo before proceeding.

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `fastify`, `@fastify/static`, `@fastify/cors` — planner must add a `checkpoint:human-verify` task before this install step (see note above; likely false-positive on "too-new" but the gate is followed as designed).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ CLI (Commander 15) — npx <package>                                    │
│  1. parse --port/--no-open/--scan                                     │
│  2. generate per-launch token = crypto.randomUUID()                   │
│  3. build Fastify app, register plugins (see below)                   │
│  4. await app.listen({ port: <flag||0>, host: '127.0.0.1' })          │
│  5. port = (app.server.address() as AddressInfo).port                 │
│  6. if (!opts.noOpen) await open(`http://127.0.0.1:${port}/?t=${tok}`)│
│  7. register SIGINT/SIGTERM -> await app.close() -> release locks     │
│         -> process.exit(0)                                            │
└───────────────────────────────┬───────────────────────────────────---┘
                                 │ builds & owns
┌────────────────────────────────▼──────────────────────────────────---┐
│ FASTIFY APP (single instance, bound 127.0.0.1 only)                   │
│                                                                         │
│  ┌── ROOT SCOPE (unguarded) ───────────────────────────────────────┐  │
│  │  @fastify/static  root: dist/client, prefix: '/'                │  │
│  │  setNotFoundHandler -> reply.sendFile('index.html')  (SPA path) │  │
│  │  onRequest (root, applies to ALL incl. /api): Host-header check │  │
│  └───────────────────────────────────────────────────────────────---┘ │
│                                                                         │
│  ┌── /api PLUGIN SCOPE (encapsulated, prefix: '/api') ─────────────┐  │
│  │  @fastify/cors  { origin: exact loopback origin only }          │  │
│  │  onRequest (plugin-scoped): x-gsd-token === launchToken check   │  │
│  │  routes: GET /api/configs, GET /api/configs/:id,                │  │
│  │          PUT /api/configs/:id  (-> saveWithSnapshot)            │  │
│  │          GET /api/snapshots/:configId  (list only, Phase 2)     │  │
│  │          POST /api/configs/:id/track                            │  │
│  └───────────────────────────────────────────────────────────────---┘ │
└───────────────────────────────┬───────────────────────────────────---┘
                                 │ calls (never bypassed)
┌────────────────────────────────▼──────────────────────────────────---┐
│ saveWithSnapshot(path, obj, validate)   [server-layer wrapper, D-10]  │
│   1. prev = readRaw(path)  (skip gracefully if ENOENT — first save)   │
│   2. await saveConfig(path, obj, validate)   <- Phase 1 FROZEN, as-is │
│   3. on success: try { snapshotStore.record(path, prev) }             │
│      catch (e) { logWarn('history not recorded'); /* non-fatal */ }   │
└───────────────────────────────┬───────────────────────────────────---┘
                                 │
                    ┌────────────┴─────────────┐
                    ▼                           ▼
      ┌─────────────────────────┐   ┌────────────────────────────────┐
      │ User's project           │   │ Snapshot Store (app-data dir)  │
      │ <proj>/.planning/        │   │ envPaths('gsd-config-manager') │
      │   config.json (WRITE     │   │   .data/snapshots/<sha256(abs  │
      │   TARGET — via Phase 1's │   │   path)>/                      │
      │   frozen saveConfig)     │   │     index.json {seq,ts,hash}[] │
      └─────────────────────────┘   │     <seq>.json  (full content) │
                                     └────────────────────────────────┘
```

**Trace the primary use case (save):** Browser `PUT /api/configs/:id` → Host-header check (root scope) → CORS origin check + token check (`/api` scope) → route handler builds `nextConfig` → `saveWithSnapshot()` → reads current on-disk content → calls Phase 1's `saveConfig` (lock → validate → atomic write → unlock) → on success, records the pre-write snapshot into the app-data directory → responds `{ ok: true, snapshotId }`.

### Recommended Project Structure

Follows the existing `packages/` monorepo layout established by Phase 1 (`config-io`, `schema-data`):

```
packages/
├── config-io/            # Phase 1 — FROZEN, untouched
├── schema-data/          # Phase 1 — FROZEN, untouched
├── cli/                  # NEW — thin launcher, the npm `bin` entry
│   └── src/
│       ├── cli.ts        # Commander program definition + shebang
│       └── bootstrap.ts  # wires CLI flags -> server start -> open -> signal handlers
└── server/                # NEW — the Local Node Service
    └── src/
        ├── app.ts         # buildApp(): Fastify instance, plugin registration, returns app
        ├── plugins/
        │   ├── host-guard.ts   # onRequest Host-header allowlist (root scope)
        │   ├── cors.ts         # @fastify/cors config (computed origin)
        │   └── token-guard.ts  # onRequest x-gsd-token check (/api scope only)
        ├── routes/
        │   └── configs.ts      # GET/PUT /api/configs[/:id], POST /:id/track
        ├── snapshot-store/
        │   ├── index.ts        # record(), list(), read() — app-data-dir I/O
        │   ├── paths.ts         # envPaths() wiring + sha256 path-hash
        │   └── save-with-snapshot.ts  # D-10 orchestration wrapper
        └── static/
            └── serve.ts         # @fastify/static registration + SPA fallback
```

### Pattern 1: Encapsulated Hook Scoping (Host-allowlist root-wide, token-guard `/api`-only)

**What:** Fastify hooks registered at the top-level app apply to every route (including static assets); hooks registered **inside** `fastify.register(apiPlugin, { prefix: '/api' })` apply only to routes defined inside that plugin. This is the built-in mechanism for "guard all API calls, leave the SPA bootstrap HTML/JS unguarded."
**When to use:** Any Fastify app that must guard a route subtree without guarding static/bootstrap assets. [CITED: fastify.dev/docs/latest/Reference/Hooks.md; github.com/fastify/fastify-auth]
**Example:**
```typescript
// app.ts
export async function buildApp(opts: { launchToken: string; allowedHosts: Set<string>; corsOrigin: string }) {
  const app = Fastify({ logger: true });

  // Root-scope hook: applies to EVERY request, including static assets.
  // A browser cannot forge the Host header -> this alone defeats DNS rebinding.
  app.addHook('onRequest', async (req, reply) => {
    const host = req.headers.host ?? '';
    if (!opts.allowedHosts.has(host)) {
      reply.code(403).send({ ok: false, errors: [{ message: 'Host not allowed' }] });
    }
  });

  // Static assets + SPA fallback — deliberately registered OUTSIDE the /api plugin,
  // so it never sees the token-guard hook below.
  await app.register(import('@fastify/static'), {
    root: path.join(distDir, 'client'),
    prefix: '/',
  });
  app.setNotFoundHandler((req, reply) => reply.sendFile('index.html'));

  // /api scope: CORS lock + token guard, both scoped to this plugin only.
  await app.register(async (api) => {
    await api.register(import('@fastify/cors'), {
      origin: (origin, cb) => cb(null, origin === opts.corsOrigin),
    });
    api.addHook('onRequest', async (req, reply) => {
      if (req.headers['x-gsd-token'] !== opts.launchToken) {
        reply.code(403).send({ ok: false, errors: [{ message: 'Missing or invalid token' }] });
      }
    });
    api.register(configRoutes); // GET/PUT /configs, etc. — resolved under /api prefix
  }, { prefix: '/api' });

  return app;
}
```
**Ordering note:** the Host-header check must run before CORS/token checks reject-cheaply on the cheapest signal first (a browser literally cannot spoof `Host`), and it must be registered at the **root**, not inside the `/api` plugin, so it also protects the static-asset routes from DNS-rebinding-driven asset scraping.

### Pattern 2: Per-Launch Token Flow

**What:** `crypto.randomUUID()` generated once per process start, embedded as a `?t=` query param in the browser-opened URL, read once by the SPA's bootstrap script, then attached as an `x-gsd-token` **header** (never a query param) on every subsequent API `fetch()` — keeping it out of server access logs.
**When to use:** Any loopback tool with filesystem write access, per the MCP Inspector CVE-2025-49596 precedent (unauthenticated MCP Inspector allowed DNS-rebinding-driven RCE; the fix added exactly this token + Origin/Host check pattern) [CITED: oligo.security/blog/critical-rce-vulnerability-in-anthropic-mcp-inspector-cve-2025-49596].
**Example:**
```typescript
// cli/src/bootstrap.ts
const launchToken = crypto.randomUUID();
const app = await buildApp({ launchToken, allowedHosts, corsOrigin });
await app.listen({ port: opts.port ?? 0, host: '127.0.0.1' });
const { port } = app.server.address() as AddressInfo;
const url = `http://127.0.0.1:${port}/?t=${launchToken}`;
if (opts.open !== false) await open(url);
console.log(`GSD Config Manager running at ${url}`);
```
```typescript
// (SPA bootstrap, Phase 3 will implement this — documented here so the contract is frozen)
const token = new URLSearchParams(location.search).get('t');
sessionStorage.removeItem('gsd-token'); // never persist across reloads
// keep `token` in an in-memory module variable, attach as header:
fetch('/api/configs', { headers: { 'x-gsd-token': token } });
```

### Pattern 3: Dynamic-Origin CORS Lock

**What:** `@fastify/cors`'s `origin` option accepts a function `(origin, cb) => void`; compute the exact expected origin (`http://127.0.0.1:<assignedPort>`) after `listen()` resolves the port, and compare with a `Set`/exact string match — never a regex or wildcard (Fastify's own docs warn that RegExp/function origins can enable DoS if crafted carelessly).
**When to use:** Whenever the origin isn't known until runtime (ephemeral port). [CITED: github.com/fastify/fastify-cors]
**Example:**
```typescript
const corsOrigin = `http://127.0.0.1:${port}`;
await api.register(cors, {
  origin(origin, cb) {
    if (!origin) return cb(null, false); // no Origin header (non-browser) -> handled by token check instead
    cb(null, origin === corsOrigin);
  },
  credentials: false, // no cookies in this model — token is a header, not a cookie
  methods: ['GET', 'PUT', 'POST'],
  allowedHeaders: ['content-type', 'x-gsd-token'],
});
```
**Ordering gotcha:** CORS registration must happen **after** the port is known, i.e. inside the plugin registered at `listen()`-time setup, not at module-load time — the origin string is a runtime value, not a build-time constant.

### Pattern 4: Ephemeral Port Bind + Readback

**What:** `listen({ port: 0, host: '127.0.0.1' })` lets the OS assign a free port; `app.server.address()` (standard Node `net.Server.address()`) returns `{ address, family, port }` after listen resolves. [CITED: fastify.dev/docs/latest/Reference/Server]
**When to use:** Always, per D-02 — avoids all `EADDRINUSE`/collision handling.
```typescript
await app.listen({ port: cliOpts.port ?? 0, host: '127.0.0.1' });
const { port } = app.server.address() as import('node:net').AddressInfo;
```
**Caveat:** if `--port <n>` is explicitly passed and that port is taken, `listen()` rejects with `EADDRINUSE` — Commander's flag handler should catch this and print a clear error rather than crash silently; this is the one collision case D-02 doesn't eliminate (only the default `port:0` path is collision-free).

### Pattern 5: Graceful, Awaited Shutdown

**What:** Register `SIGINT`/`SIGTERM` handlers that **`await`** `fastify.close()` (not fire-and-forget) before calling `process.exit(0)`, guard against duplicate signal handling with a re-entrancy flag, and add a bounded force-exit `setTimeout` as a safety net. [CITED: github.com/fastify/fastify discussion #5140 — "the key insight is that I wasn't awaiting the call to fastify.close()"]
```typescript
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);
  const forceExit = setTimeout(() => process.exit(1), 5_000).unref();
  try {
    await app.close(); // releases the listening socket
    await activeSnapshotLocks.releaseAll(); // proper-lockfile: no held locks survive exit
  } finally {
    clearTimeout(forceExit);
    process.exit(0);
  }
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
```
**Do not** adopt the `close-with-grace` package's default (500ms force-exit) — documented as too aggressive even for simple in-flight requests [CITED: github.com/fastify/fastify-cli issue #531]. Hand-rolling the ~15-line pattern above, with a generous 5s force-exit safety net, is simpler and safer for a single-user local tool with no real "in-flight request drain" concern.

### Pattern 6: Snapshot Store Layout

**What:** `env-paths('gsd-config-manager').data` resolves the OS-conventional app-data root; each tracked config gets a subfolder keyed by `sha256(path.resolve(configPath))` (stable across relative-path variance, collision-resistant, no filesystem-illegal characters); each save (except the very first) writes a full-JSON snapshot file plus appends an entry to that config's `index.json`.
```typescript
// snapshot-store/paths.ts
import envPaths from 'env-paths';
import { createHash } from 'node:crypto';
import path from 'node:path';

const paths = envPaths('gsd-config-manager', { suffix: '' }); // no 'nodejs' suffix — this IS the app
export function snapshotDirFor(configPath: string): string {
  const key = createHash('sha256').update(path.resolve(configPath)).digest('hex');
  return path.join(paths.data, 'snapshots', key);
}
```
```typescript
// snapshot-store/index.ts — index.json shape (D-09: seq + timestamp + hash, migration-free pruning later)
interface SnapshotIndexEntry {
  seq: number;          // monotonic per-config sequence number
  timestamp: string;    // ISO 8601
  contentHash: string;  // sha256 of the snapshotted content — enables future de-dupe
  file: string;          // relative filename, e.g. "3.json"
}
interface SnapshotIndex { entries: SnapshotIndexEntry[] }

export async function record(configPath: string, priorContent: string | null): Promise<string | undefined> {
  if (priorContent === null) return undefined; // D-11: first-ever save has nothing to snapshot — skip gracefully
  const dir = snapshotDirFor(configPath);
  await fs.mkdir(dir, { recursive: true });
  const index = await readIndex(dir); // { entries: [] } if index.json doesn't exist yet
  const seq = (index.entries.at(-1)?.seq ?? 0) + 1;
  const contentHash = createHash('sha256').update(priorContent).digest('hex');
  const file = `${seq}.json`;
  await fs.writeFile(path.join(dir, file), priorContent, 'utf8');
  index.entries.push({ seq, timestamp: new Date().toISOString(), contentHash, file });
  await fs.writeFile(path.join(dir, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
  return `${path.basename(dir)}:${seq}`; // snapshotId returned in the API response
}
```
**[ASSUMED]** — the exact `index.json` field names/shape above are this research's proposed design (seeded from `ARCHITECTURE.md` §Pattern 4's "seq + timestamp + content hash" requirement), not sourced from any external precedent. The planner/executor may rename fields, but should preserve the three D-09-mandated fields.

### Pattern 7: `saveWithSnapshot()` — Server-Layer Composition, Frozen `saveConfig` Untouched

**What:** D-10 mandates this wrapper live in the server layer and call Phase 1's `saveConfig` unmodified. Order: read current on-disk content (for the pre-write snapshot) → `saveConfig` (which does lock → validate → atomic write → unlock internally) → on success, best-effort snapshot record (D-12: non-fatal).
```typescript
import { saveConfig, ValidationError } from '@gsd-config-manager/config-io';
import { record as recordSnapshot } from '../snapshot-store/index.js';

export async function saveWithSnapshot(
  configPath: string,
  nextConfig: object,
  validate: (data: unknown) => ValidationResult,
): Promise<{ ok: true; snapshotId?: string } | { ok: false; errors: object[] }> {
  let priorContent: string | null;
  try {
    priorContent = await fs.readFile(configPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') priorContent = null; // D-11
    else throw err;
  }

  try {
    await saveConfig(configPath, nextConfig, validate); // Phase 1 FROZEN — untouched
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, errors: err.errors };
    throw err;
  }

  let snapshotId: string | undefined;
  try {
    snapshotId = await recordSnapshot(configPath, priorContent); // D-12: failure here must not fail the save
  } catch (err) {
    console.warn('[snapshot] failed to record history (save still succeeded):', err);
  }
  return { ok: true, snapshotId };
}
```
**This is also the exact function Phase 5's revert must call** (per D-10: "revert-as-write, no special-case path") — revert simply reads a past snapshot's content and calls `saveWithSnapshot(configPath, snapshotContent, validate)`.

### Anti-Patterns to Avoid

- **Registering the token/CORS guard at the root scope instead of the `/api` plugin scope:** breaks the SPA bootstrap — the browser has no token until it has loaded `index.html`, so guarding static assets makes the tool unusable.
- **Fire-and-forget `fastify.close()`** in a signal handler: the process can `process.exit()` before the socket is actually released, intermittently failing DIST-04's "port released" criterion under test.
- **Wildcard CORS (`origin: '*'`) or trusting loopback bind alone:** explicitly the CLAUDE.md "What NOT to Use" entry; defeats the entire security model this phase exists to build.
- **A single-instance PID-lock guard:** explicitly declined (D-03) — do not add this even as a "nice to have."
- **Hardcoding the CORS origin at module load time:** the origin string depends on the ephemeral port, which isn't known until `listen()` resolves — must be computed after bind, not before.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static file serving + caching headers for the SPA | A custom `fs.readFile` + `Content-Type` sniffing route | `@fastify/static` | Handles range requests, ETags, caching headers, and the `setNotFoundHandler` SPA-fallback pattern correctly out of the box |
| CORS origin checking | A hand-written `onRequest` hook comparing `req.headers.origin` | `@fastify/cors` with a function-based `origin` | The plugin correctly handles preflight `OPTIONS` requests, `Vary` headers, and the credentials/methods/headers negotiation that a hand-rolled check will miss |
| CLI flag parsing (`--port`, `--no-open`, negatable booleans) | Manual `process.argv` parsing | `commander` | Negatable-boolean semantics (`--no-open` defaulting `open` to `true` unless negated) are a documented, easy-to-get-wrong edge case; Commander implements this correctly |
| Cross-platform app-data path resolution | Hand-rolled `process.platform` branching for `%APPDATA%`/XDG/`~/Library` | `env-paths` | OS conventions have real edge cases (XDG env var overrides, Windows `%LOCALAPPDATA%` vs `%APPDATA%` distinction) that a naive `if (win32)` branch will get wrong |
| Browser auto-launch across OS/WSL | Shelling out to `start`/`xdg-open`/`open` manually | `open` (Sindre Sorhus) | Already handles the WSL-to-Windows-browser interop edge case and per-platform command differences |
| Token/hash generation | A custom random-string generator or non-cryptographic hash | `crypto.randomUUID()` / `crypto.createHash('sha256')` | Node's built-in `crypto` module is the correct, audited primitive — CLAUDE.md's cross-cutting "never hand-roll cryptography" posture applies directly here |
| Atomic config writes, advisory locking | Anything beyond calling Phase 1's `saveConfig` | Phase 1's frozen `saveConfig`/`writeWithRetry` | Already built, tested, and hardened (Windows EPERM/EBUSY/EACCES retry) in Phase 1 — Phase 2 must never reimplement or bypass this |

**Key insight:** Every "don't hand-roll" item above already has a CLAUDE.md-pinned, current, actively-maintained library backing it. The only genuinely new logic this phase writes is the **composition** — hook ordering, the `saveWithSnapshot` wrapper, and the `index.json` snapshot format — not any of the underlying primitives.

## Common Pitfalls

### Pitfall 1: Guarding static assets accidentally blocks SPA bootstrap
**What goes wrong:** A single global `onRequest` hook checking `x-gsd-token` is added at the Fastify root instead of inside the `/api` plugin scope. The browser's very first request (for `index.html`) has no token to send yet (it hasn't parsed the URL's `?t=` param into a header), so it gets rejected and the UI never loads.
**Why it happens:** "Guard everything" (D-04's literal wording — "reads and writes both") is easy to over-apply to the wrong scope; D-04 means "guard every `/api` route," not "guard every HTTP request including the bootstrap page."
**How to avoid:** Use Fastify's plugin encapsulation (Pattern 1) — register the token-guard hook strictly inside the `/api`-prefixed plugin, never at the app root. The Host-header check, by contrast, correctly belongs at the root (it should also protect static-asset scraping from a rebound origin).
**Warning signs:** Manual smoke test — opening the printed URL shows a blank page or a 403 instead of the SPA shell.

### Pitfall 2: Fire-and-forget `fastify.close()` fails the "port released" success criterion
**What goes wrong:** `process.on('SIGINT', () => { fastify.close(); process.exit(0); })` calls `process.exit(0)` synchronously right after issuing (not awaiting) `close()`. The event loop never gets a chance to actually finish closing the socket before the process dies, so on a fast machine the port can appear still bound for a brief window, and any pending snapshot-store lock release never completes.
**Why it happens:** The synchronous "close then exit" pattern looks correct and works often enough in casual manual testing to pass unnoticed. [CITED: github.com/fastify/fastify discussion #5140]
**How to avoid:** Always `await fastify.close()` before `process.exit()` (Pattern 5); add an automated spawned-process test that sends `SIGINT` and then immediately attempts a new TCP connection to the same port, asserting `ECONNREFUSED`.
**Warning signs:** Flaky "orphaned process" reports specifically under fast-repeated launch/kill cycles, or in CI where machines run faster than a developer's manual Ctrl-C test.

### Pitfall 3: Windows signal delivery is not equivalent to POSIX
**What goes wrong:** `SIGTERM`/`SIGINT` handling in Node.js on Windows works when the terminal delivers Ctrl-C directly to the Node process, but is unreliable when the process is spawned indirectly (e.g. via certain shell wrappers, or `child_process.spawn` without `{ stdio: 'inherit' }` and proper console attachment) — a `SIGKILL`-equivalent hard-terminate bypasses `proper-lockfile`'s automatic exit-cleanup entirely, per its own documented caveat ("automatically removes locks if the process exits, except if the process is killed with SIGKILL or it crashes due to a VM fatal error").
**Why it happens:** Windows does not have real POSIX signals; Node's `SIGINT`/`SIGTERM` emulation on Windows has known edge cases around how the console/terminal delivers the interrupt to child/grandchild processes.
**How to avoid:** Test Ctrl-C teardown on the actual target platform (Windows 11, per this project's environment) using a real spawned terminal process, not just `child_process.kill('SIGINT')` in a test harness (which behaves differently from a real Ctrl-C on Windows). Document that a hard-kill (Task Manager "End Task") is an accepted edge case that may leave a stale `proper-lockfile` lock — `proper-lockfile`'s own stale-timeout mechanism (the `stale: 10_000` option already used in Phase 1's `saveConfig`) is what recovers from this, not graceful-shutdown code.
**Warning signs:** "Orphaned lock file" reports specifically from Windows users who used Task Manager or closed the terminal window (not Ctrl-C) to stop the tool.

### Pitfall 4: `tsup`'s default dependency-externalization breaks a monorepo workspace build
**What goes wrong:** `tsup` by default reads `dependencies`/`peerDependencies` from `package.json` and marks them `external` (excluded from the bundle) — correct for `fastify`/`commander`/etc. (real npm packages that will be installed alongside the published package), but if `packages/cli` depends on `packages/server` or `packages/config-io` as **workspace-local** packages (not published to npm), externalizing them means the published tarball's `dist/cli.js` will `require()` a package that does not exist on the end user's machine.
**Why it happens:** tsup's external-by-default behavior is correct for the common "publish a library with real npm peer deps" case, but this project's workspace packages (`config-io`, `schema-data`, `server`) are not independently published — they only exist inside this monorepo.
**How to avoid:** Either (a) bundle workspace-local packages into `dist/cli.js` explicitly (tsup's `noExternal` option, matching workspace package names), or (b) publish the CLI as a single package whose `tsup` entry imports the *source* of the sibling workspace packages directly (not through `node_modules` resolution) so esbuild inlines them naturally. Verify with `npm pack --dry-run` from a clean `node_modules` state (or `npm pack` inside a temp extraction + `node dist/cli.js`) — never just "it worked in my dev environment where the workspace symlinks are present."
**Warning signs:** The published/packed tarball runs fine locally (workspace symlinks present) but fails with `Cannot find module '@gsd-config-manager/config-io'` when installed fresh via `npx` on another machine.

### Pitfall 5: `npm pack --dry-run` "looks right" but `dist/client` is stale or missing
**What goes wrong:** The `files` field lists `dist/client`, but the Vite build was never run (or was run against stale source) before `npm pack`/`npm publish`, so the tarball either omits the directory entirely (if the build never ran) or ships a stale bundle.
**Why it happens:** `npm pack --dry-run` only reports what's *currently on disk* matching the `files` field — it cannot detect "this directory is stale," only "this directory doesn't exist."
**How to avoid:** Wire `vite build && tsup` into a `prepublishOnly` (or equivalent CI) script so the build always runs immediately before packing; add an explicit assertion step (parse `npm pack --dry-run --json` output, assert `dist/client/index.html` and `dist/cli.js` are present) rather than eyeballing the human-readable listing.
**Warning signs:** A published `npx` install opens a blank page or 404s on all static assets despite the server starting successfully.

### Pitfall 6: CORS `origin` regex/function crafted carelessly enables DoS
**What goes wrong:** Fastify's own docs explicitly warn that using a `RegExp` or function for the `origin` option "may enable Denial of Service attacks" if crafted without care (e.g., a catastrophic-backtracking regex evaluated on every request).
**Why it happens:** A regex-based origin check (`/^https?:\/\/127\.0\.0\.1(:\d+)?$/`) feels natural but risks accidental ReDoS if the pattern is later extended carelessly.
**How to avoid:** Use exact string comparison against a precomputed `Set`/string (Pattern 3), never a regex, since the loopback origin is a single known value computed once after bind — there is no need for pattern matching at all.
**Warning signs:** N/A preventable-by-design; flagged here only because it's an explicit Fastify docs warning relevant to this exact configuration.

## Code Examples

### Commander 15 CLI skeleton
```typescript
// cli/src/cli.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { bootstrap } from './bootstrap.js';

const program = new Command();
program
  .name('gsd-config-manager')
  .option('-p, --port <number>', 'port to bind (default: OS-assigned)', (v) => parseInt(v, 10))
  .option('--no-open', 'do not automatically open the browser')
  .option('--scan <dir>', 'scan a directory for .planning/config.json files on startup')
  .parse(process.argv);

await bootstrap(program.opts());
```
[CITED: github.com/tj/commander.js/blob/HEAD/examples/options-negatable.js — `--no-open` declared alone makes `options.open` default `true`, `false` only when `--no-open` is explicitly passed]

### `package.json` packaging fields (DIST-03/04)
```jsonc
{
  "name": "gsd-config-manager",
  "bin": { "gsd-config-manager": "./dist/cli.js" },
  "files": ["dist/cli.js", "dist/client/**"],
  "scripts": {
    "build": "vite build --config web/vite.config.ts && tsup",
    "prepublishOnly": "npm run build && npm pack --dry-run"
  }
}
```
[CITED: docs.npmjs.com/cli/v11/commands/npm-pack — `files` field + `.npmignore` determine tarball contents; `--dry-run` reports contents without writing a tarball]

### `tsup.config.ts` for the CLI bundle
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['packages/cli/src/cli.ts'],
  format: ['esm'],       // required: `open@11` is ESM-only, no CJS export
  platform: 'node',
  target: 'node20',
  clean: true,
  noExternal: ['@gsd-config-manager/config-io', '@gsd-config-manager/server'], // workspace-local, must be bundled (Pitfall 4)
  // fastify/commander/@fastify/*/open/env-paths/proper-lockfile/write-file-atomic
  // stay external automatically (read from package.json dependencies)
});
```
[CITED: tsup docs — shebang auto-preserved + output auto-chmod'd when the entry file starts with `#!/usr/bin/env node`; `external`/`noExternal` control bundling]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| "It's just localhost, no auth needed" | Loopback bind + Host allowlist + locked CORS + per-launch token, as a baseline expectation for any local dev-tool server | Crystallized industry-wide after the Vite dev-server CVE (GHSA-vg6x-rcgg-rjx6, Jan 2025) and MCP Inspector CVE-2025-49596 (mid-2025) | This is no longer "extra hardening" — it is the baseline expected posture for any `npx`-launched loopback tool in 2026, exactly matching this phase's D-04/D-05/D-06 |
| Fire-and-forget `server.close()` in signal handlers | Awaited `close()` + bounded force-exit timeout | Long-standing Node.js best practice, but still a common real-world bug (see Fastify discussion #5140, reported against a recent Fastify version) | Directly affects DIST-04's "port released, no orphan" success criterion — must be tested, not assumed |
| `close-with-grace` default 500ms shutdown window | Explicit, generous (multi-second) force-exit timeout, hand-rolled or configured | Flagged as a live concern in `fastify-cli` issue #531 | Relevant here because a 500ms window is needlessly aggressive for a single-user local tool with no real concurrent-request-drain requirement |
| `tsup` as the default TS-bundler choice for new projects | `tsup`'s own README now points new projects at `tsdown` | tsup entered maintenance mode circa 2025 | Not a blocker — CLAUDE.md locks `tsup@8.5.1` and this project isn't starting from zero; documented here as a forward-looking note only, not a call to switch |

**Deprecated/outdated:**
- Trusting `127.0.0.1` binding alone as a complete security boundary — explicitly superseded by the Host+Origin+token layered model this phase implements.
- `get-port`-style manual port-collision handling for a tool that has no reason to prefer a fixed port — superseded by `listen(0, ...)` + readback (D-02).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `index.json` snapshot-entry field names/shape (`seq`, `timestamp`, `contentHash`, `file`) | Pattern 6 | Low — this is an internal-only format this phase itself defines; D-09 only mandates the three semantic fields exist, not their exact names. Planner/executor may rename freely as long as seq+timestamp+hash are present for future pruning. |
| A2 | `env-paths` chosen over `platform-folders`/hand-rolled path resolution as the D-07 "exact env-paths library" discretion pick | Standard Stack, Don't Hand-Roll | Low — pure-JS, no native addon, Sindre-Sorhus-maintained, matches the CLAUDE.md-adjacent ecosystem style (same author as `open`, already in the stack); if wrong, swapping is a single-file change (`snapshot-store/paths.ts`) |
| A3 | Proposed REST route shape (`GET/PUT /api/configs[/:id]`, `POST /:id/track`, `GET /api/snapshots/:configId`) | System Architecture Diagram | Medium — this is Claude's-discretion territory per CONTEXT.md; Phase 3's UI will build against whatever the planner finalizes here, so a route-shape change after Phase 3 starts is a breaking-change cost. Recommend the planner treat this as a design decision to confirm explicitly in the phase plan, not silently inherit from this research. |
| A4 | `tsup` `noExternal` is the correct fix for Pitfall 4 (workspace-local package bundling), rather than restructuring the monorepo to publish `config-io`/`server` as separate npm packages | Code Examples, Pitfall 4 | Medium — verified only via general tsup documentation (`external`/`noExternal` options exist and behave this way), not tested against this project's actual workspace configuration. The planner should verify with a real `npm pack` + fresh-install smoke test (already recommended in the Validation Architecture below), not just trust this research. |
| A5 | Dev-vs-prod static serving recommendation (run Vite's own dev server directly during frontend development, rather than proxying through Fastify) | Claude's Discretion note, inline in Summary | Low — avoids adding an `@fastify/http-proxy` dependency Phase 2 doesn't otherwise need; if Phase 3 later wants live-reload through the Fastify server itself, this can be revisited without touching the production `@fastify/static` path. |

**If this table is empty:** N/A — see entries above; all are LOW-MEDIUM risk and none block planning.

## Open Questions

1. **Exact REST API route naming and response envelope**
   - What we know: CONTEXT.md explicitly leaves this to Claude's Discretion; a reasonable shape is proposed in the System Architecture Diagram and Assumptions Log (A3).
   - What's unclear: Whether Phase 3's UI research/planning has any prior expectations that should constrain this now, versus Phase 2 being fully free to decide.
   - Recommendation: The Phase 2 plan should explicitly write the finalized route contract into its own output (e.g. a short `API-CONTRACT.md` or inline in the plan) so Phase 3's research/planning can consume it as a frozen input, mirroring how Phase 1 froze `config-io`'s public API for this phase.

2. **Whether SSE (schema-refresh progress, file-change push) is needed in Phase 2**
   - What we know: `ARCHITECTURE.md` describes SSE for schema-refresh progress (Phase 6) and file-change detection (`chokidar`, not in this phase's locked dependency list).
   - What's unclear: None of Phase 2's 5 success criteria require SSE or `chokidar` — CONTEXT.md's decisions (D-01 through D-12) never mention either.
   - Recommendation: Do not add SSE or `chokidar` to Phase 2's scope; defer both to whichever later phase actually needs them (schema-refresh is Phase 6 per `SUMMARY.md`'s roadmap implications).

3. **What exactly Phase 2's "placeholder/minimal served page" should contain**
   - What we know: CONTEXT.md explicitly allows a placeholder for DIST-03 verification, since Phase 3 builds the real UI.
   - What's unclear: Whether the placeholder needs to demonstrate the full token-flow (fetch an authenticated `/api` route and render its result) to be a meaningful verification of SEC-01/SEC-02, or whether a static "server is running" page plus a `curl`/`fastify.inject()`-driven automated test is sufficient.
   - Recommendation: Favor the automated-test route (Validation Architecture below) over a hand-built placeholder UI feature — keeps Phase 2 backend-only per its stated scope, and is more reliably verifiable than "eyeball the placeholder page."

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Entire phase (server + CLI runtime) | ✓ | v24.6.0 | — (exceeds CLAUDE.md's `>=20.19` floor and matches the "dev on 22/24 LTS" target) |
| npm | Package install, `npm pack --dry-run` verification | ✓ | 11.14.1 | — |
| Windows 11 (target platform) | SIGINT/SIGTERM teardown testing, Windows-specific file-lock behavior | ✓ (confirmed dev environment) | Windows 11 Pro 10.0.26100 | — |
| A real terminal delivering Ctrl-C (not just `child_process.kill()`) | DIST-04 manual/E2E verification of clean teardown | Must be verified manually at least once | — | Automated test uses `child_process.spawn` + `.kill('SIGINT')` as an approximation (Node emulates this reasonably on Windows for direct child processes), but a true manual Ctrl-C-in-a-real-terminal check should also be part of UAT per Pitfall 3 |

**Missing dependencies with no fallback:** none — this phase has no database, no external service, and no dependency this machine lacks.

**Missing dependencies with fallback:** Real-terminal Ctrl-C testing (see above) — automated spawned-process signal tests are the primary, repeatable verification; a one-time manual check supplements it per the Windows signal-delivery caveat (Pitfall 3).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest` 4.1.10 (already configured, `test:unit` script exists from Phase 1) |
| Config file | `vitest.config.ts` (repo root, already exists per Phase 1) |
| Quick run command | `npx vitest run test/server --reporter=dot` |
| Full suite command | `npm test` (runs `vitest run`, covers Phase 1 + Phase 2 suites) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIST-01 | `npx <package>` starts with no separate setup | integration (spawned process) | `vitest run test/server/cli-launch.test.ts -t "starts and serves"` | ❌ Wave 0 |
| DIST-02 | Binds 127.0.0.1, opens browser | integration (mock `open`, assert called with correct URL+token) | `vitest run test/server/cli-launch.test.ts -t "opens browser with token"` | ❌ Wave 0 |
| DIST-03 | Bundled UI ships in the npm tarball | build+pack assertion | `npm run build && npm pack --dry-run --json > /tmp/pack.json && vitest run test/packaging/tarball-contents.test.ts` | ❌ Wave 0 |
| DIST-04 | Ctrl-C releases port + locks, no orphan process | integration (spawn, `SIGINT`, assert `ECONNREFUSED` + no lock file + exit code) | `vitest run test/server/teardown.test.ts -t "SIGINT releases port and locks"` | ❌ Wave 0 |
| SEC-01 | Non-allowlisted Host header rejected (403) | unit (`fastify.inject()`) | `vitest run test/server/security.test.ts -t "rejects bad Host header"` | ❌ Wave 0 |
| SEC-01 | Cross-origin request rejected | unit (`fastify.inject()` with `Origin` header) | `vitest run test/server/security.test.ts -t "rejects cross-origin"` | ❌ Wave 0 |
| SEC-02 | Mutating request without token rejected (403) | unit (`fastify.inject()`, `PUT /api/configs/:id` with no `x-gsd-token`) | `vitest run test/server/security.test.ts -t "rejects missing token"` | ❌ Wave 0 |
| SEC-02 | Read request without token also rejected (D-04, stricter than literal SEC-02) | unit (`fastify.inject()`, `GET /api/configs` with no token) | `vitest run test/server/security.test.ts -t "rejects missing token on reads"` | ❌ Wave 0 |
| SAVE-04 | Every successful save creates a snapshot outside the tracked project | integration (temp config dir, real `saveWithSnapshot` calls against a real temp file + a stubbed app-data dir) | `vitest run test/server/snapshot-store.test.ts -t "records snapshot before overwrite"` | ❌ Wave 0 |
| SAVE-04 | First-ever save skips gracefully (D-11) | integration | `vitest run test/server/snapshot-store.test.ts -t "skips snapshot on first save"` | ❌ Wave 0 |
| SAVE-04 | Snapshot failure is non-fatal (D-12) | unit (inject a failing snapshot recorder, assert save still succeeds with a warning) | `vitest run test/server/snapshot-store.test.ts -t "save succeeds even if snapshot recording fails"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run test/server --reporter=dot` (fast unit/inject tests only, skip the spawned-process integration tests during rapid iteration)
- **Per wave merge:** `npm test` (full suite, including spawned-process CLI-launch and teardown tests)
- **Phase gate:** Full suite green, plus one manual real-terminal Ctrl-C smoke test on Windows (Pitfall 3), before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/server/security.test.ts` — Host-header, CORS-origin, and token-guard rejection cases via `fastify.inject()` — covers SEC-01, SEC-02
- [ ] `test/server/cli-launch.test.ts` — spawned-process test asserting the CLI binds, prints a URL, and calls `open` with the correct token — covers DIST-01, DIST-02
- [ ] `test/server/teardown.test.ts` — spawned-process `SIGINT` test asserting port release + lock cleanup + clean exit — covers DIST-04
- [ ] `test/server/snapshot-store.test.ts` — `saveWithSnapshot` orchestration against a temp dir + stubbed `env-paths` root — covers SAVE-04 (D-10, D-11, D-12)
- [ ] `test/packaging/tarball-contents.test.ts` — parses `npm pack --dry-run --json` output, asserts `dist/client/index.html` and the `bin` entry are present — covers DIST-03
- [ ] Test helper: a small `spawnCli(args): { proc, port, url }` utility that spawns the built CLI, waits for its "listening" stdout line (or a written port file), and returns the resolved port — needed by both `cli-launch.test.ts` and `teardown.test.ts`
- [ ] Framework install: none — `vitest` already present from Phase 1; no `supertest`/`undici` dependency needed since `fastify.inject()` covers all the security-rejection cases without a real listening socket

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Yes (adapted for a single-user local tool) | Per-launch random token (`crypto.randomUUID()`) checked via a constant-shape header comparison on every `/api` request — not a full multi-user auth system, but fills the equivalent role for this trust model |
| V3 Session Management | Partial | The token is a de-facto single "session" for the process lifetime — no session store, no expiry/rotation needed since the token dies with the process; no cookies are used (avoids CSRF-via-cookie entirely) |
| V4 Access Control | Minimal (single local user, no roles) | N/A beyond "has the token or doesn't" — no per-route authorization tiers needed in this phase |
| V5 Input Validation | Yes | Fastify route schemas + Phase 1's frozen Ajv validator (`createValidator`) gate every `PUT /api/configs/:id` body before it ever reaches `saveConfig` |
| V6 Cryptography | Yes | `crypto.randomUUID()` for the token, `crypto.createHash('sha256')` for both the snapshot path-hashing scheme and the snapshot content-hash — never hand-rolled |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| DNS rebinding (attacker page rebinds a domain to `127.0.0.1` after initial same-origin check passes) | Spoofing / Tampering | `Host` header allowlist at the Fastify root scope (Pattern 1) — a browser cannot forge `Host`, so this alone defeats the attack class regardless of what the resolved IP is |
| Cross-origin `fetch()`/form-post from any other open tab against the loopback API | Tampering / Information Disclosure | `@fastify/cors` locked to the exact computed loopback origin via a function-based, `Set`-backed check (Pattern 3) — never wildcard, never a regex |
| A non-browser local process/script probing the API without a browser Origin header at all | Spoofing | Per-launch token required on every `/api` request regardless of Origin presence (D-04/Pattern 2) — closes the gap CORS alone can't cover (CORS is a browser-enforced control, meaningless against `curl`) |
| ReDoS via a carelessly-crafted CORS `origin` regex | Denial of Service | Exact string/`Set` comparison only (Pattern 3/Pitfall 6) — the origin is a single known value computed once after bind, so no pattern-matching is ever needed |
| Token leakage via server access logs (token passed as a query param on API calls, not just the initial page load) | Information Disclosure | D-05: token travels as `?t=` only on the one-time initial page load (which Fastify's default logger will log, an accepted one-time exposure to the local log stream); every subsequent `/api` call sends it as the `x-gsd-token` **header**, which most default logger configs do not print |
| Snapshot/history data leaking secret-shaped config fields into app-data-dir files or logs | Information Disclosure | Out of literal Phase 2 scope (masking is SEC-03, Phase 4) but relevant here: snapshot files are full-content JSON copies stored in `env-paths`'s app-data dir with default OS file permissions (user-only on all three target OSes) — no additional masking needed at the storage layer since the *live* config file itself is unmasked plaintext on disk already; do not log snapshot content in any warning/error message (mirrors Phase 1's `ValidationError`, which never includes the config body) |
| Path traversal via a config path supplied to the API (`configPath` parameter escaping the tracked-list boundary) | Tampering | Out of literal Phase 2 scope (Discovery/tracked-list validation is largely a Phase 3 concern per `ARCHITECTURE.md`'s "Discovery" module boundary), but the `/api/configs/:id` route handlers built in this phase should resolve `:id` against a server-held tracked-list mapping (not accept a raw filesystem path directly from the client) so this boundary is correct from day one rather than retrofitted |

## Sources

### Primary (HIGH confidence)
- `registry.npmjs.org` direct `npm view` queries (2026-07-12) — confirmed live version numbers for `fastify`, `@fastify/static`, `@fastify/cors`, `commander`, `open`, `tsup`, `proper-lockfile`, `write-file-atomic`, `env-paths`, matching CLAUDE.md's pinned stack table
- `gsd-tools query package-legitimacy check` (2026-07-12) — per-package registry-existence, download-count, repo-URL, and postinstall-script signals for the legitimacy audit above
- `packages/config-io/src/index.ts`, `packages/config-io/src/atomic-write.ts` (this repo, read directly) — Phase 1's frozen public API and `saveConfig` pipeline internals that `saveWithSnapshot` composes
- `.planning/config.json` (this repo, read directly) — confirmed `workflow.nyquist_validation: true` and `workflow.security_enforcement: true` (ASVS level 3), driving the inclusion of the Validation Architecture and Security Domain sections

### Secondary (MEDIUM confidence — WebSearch results directly quoting official docs/repos)
- [fastify.dev/docs/latest/Reference/Hooks](https://fastify.dev/docs/latest/Reference/Hooks/) and [github.com/fastify/fastify/blob/main/docs/Reference/Hooks.md](https://github.com/fastify/fastify/blob/main/docs/Reference/Hooks.md) — hook execution order, encapsulation/scoping semantics
- [github.com/fastify/fastify-auth](https://github.com/fastify/fastify-auth) — route-level vs plugin-level auth-hook scope distinction
- [github.com/fastify/fastify-static](https://github.com/fastify/fastify-static) / [npmjs.com/package/@fastify/static](https://www.npmjs.com/package/@fastify/static) — SPA `setNotFoundHandler` fallback pattern, `wildcard` option semantics
- [github.com/fastify/fastify-cors](https://github.com/fastify/fastify-cors) — function-based dynamic `origin` callback, ReDoS warning on regex/function origins
- [fastify.dev/docs/latest/Reference/Server](https://fastify.dev/docs/latest/Reference/Server/) — `listen()`/`server.address()` ephemeral-port readback
- [github.com/fastify/fastify discussion #5140](https://github.com/fastify/fastify/discussions/5140) — awaited-vs-fire-and-forget `fastify.close()` bug pattern
- [github.com/fastify/fastify-cli issue #531](https://github.com/fastify/fastify-cli/issues/531) — `close-with-grace` 500ms default-window concern
- [github.com/tj/commander.js](https://github.com/tj/commander.js/blob/HEAD/examples/options-negatable.js) — negatable `--no-*` boolean option semantics
- [npmjs.com/package/open](https://www.npmjs.com/package/open) — WSL Windows-browser interop, ESM-only export caveat
- [docs.npmjs.com/cli/v11/commands/npm-pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/) — `--dry-run` behavior, `files` field / `.npmignore` precedence
- [github.com/sindresorhus/env-paths](https://github.com/sindresorhus/env-paths) — cross-platform app-data path API and conventions
- [github.com/moxystudio/node-proper-lockfile](https://github.com/moxystudio/node-proper-lockfile) — automatic lock cleanup on graceful exit, `SIGKILL`/crash exception, `onCompromised` semantics
- [oligo.security/blog/critical-rce-vulnerability-in-anthropic-mcp-inspector-cve-2025-49596](https://www.oligo.security/blog/critical-rce-vulnerability-in-anthropic-mcp-inspector-cve-2025-49596) — direct precedent for the token+Host+Origin layered defense this phase implements
- [www.jsdocs.io/package/tsup](https://www.jsdocs.io/package/tsup) and [github.com/egoist/tsup](https://github.com/egoist/tsup) — shebang preservation, `external`/`noExternal`, maintenance-mode note

### Tertiary (LOW confidence)
- Proposed `index.json` snapshot-entry field shape (Pattern 6) — original design synthesis for this research, not sourced externally; flagged in the Assumptions Log (A1)
- Proposed REST route naming (System Architecture Diagram) — Claude's-discretion design proposal, flagged in the Assumptions Log (A3)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version independently re-verified against the live npm registry this session, matching the project's own prior HIGH-confidence `STACK.md` research and CLAUDE.md's locked table exactly
- Architecture: HIGH — the loopback+token+Host-allowlist pattern is directly precedented by a real, recent, high-profile CVE fix (MCP Inspector CVE-2025-49596) and Fastify's own documented encapsulation model, not a novel design
- Pitfalls: MEDIUM-HIGH — Fastify/Node-specific pitfalls (hook scoping, awaited close, tsup externalization) are grounded in official docs and real GitHub issues/discussions; the Windows-signal-delivery caveat (Pitfall 3) is MEDIUM confidence, general Node/Windows knowledge cross-checked but not verified against this exact package's behavior on this exact machine — flagged for explicit manual verification in the Validation Architecture

**Research date:** 2026-07-12
**Valid until:** 2026-08-11 (30 days — stable, well-established libraries and patterns; re-verify package versions if planning is delayed materially past this window, particularly `fastify`/`@fastify/static`/`@fastify/cors` given their SUS "recent publish" flags)

---
*Phase: 2-Local Loopback Server, CLI & Security Hardening*
*Research completed: 2026-07-12*
