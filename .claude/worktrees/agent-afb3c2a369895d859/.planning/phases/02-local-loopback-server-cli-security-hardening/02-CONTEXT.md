# Phase 2: Local Loopback Server, CLI & Security Hardening - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the **launch + trust + durability layer**: a single `npx <package>` command that boots a **127.0.0.1-only** HTTP server, auto-opens the UI in the default browser, defends the port against other local tabs/processes, shuts down cleanly on Ctrl-C, ships as a **public npm package with the built UI bundled inside**, and **auto-snapshots every successful save** to a store outside the tracked project.

**No UI screens are built here** — Phase 3 builds the schema-driven UI. Phase 2 produces the server those screens will call, the security middleware, the CLI/launcher, the packaging pipeline, and the snapshot store + save-with-snapshot wrapper.

**Requirements:** DIST-01, DIST-02, DIST-03, DIST-04, SEC-01, SEC-02, SAVE-04.

**Builds directly on Phase 1:** the frozen `packages/config-io` public API barrel (`saveConfig`, `load`, `createValidator`, etc.). `saveConfig(path, obj, validate)` already does `lock → validate → atomic write-with-retry → release`. Phase 2 wraps — never modifies — this.
</domain>

<decisions>
## Implementation Decisions

### Launch & server stack
- **D-01: Fastify + Commander (locked stack).** Resolve the CLAUDE.md-vs-research conflict in favor of CLAUDE.md's stack table: **Fastify 5** for the server (built-in Ajv route validation reusing the project's Ajv, `@fastify/static` for the bundled SPA, `@fastify/cors` for Origin locking) + **Commander 15** for CLI flag parsing (`--port`, `--no-open`, `--scan/--dir`). Chosen over the research ARCHITECTURE.md "minimal node:http + no CLI framework" sketch — the user wants the robust, schema-validated server the stack was researched around.
- **D-02: OS-assigned ephemeral port.** Bind with `listen(0, '127.0.0.1')`, read the assigned port back from `server.address()`, then print/open the URL. No `get-port` dependency, zero collision handling needed. (Research's own sketch uses this.)
- **D-03: SIGINT/SIGTERM handler for clean teardown; no single-instance lock.** Register signal handlers that close the HTTP server and release any `proper-lockfile` locks, then exit — satisfying success criterion 3 (port released, no orphan process or lock file). **No** single-instance enforcement: a second `npx` launch simply gets its own ephemeral port.

### Security model (SEC-01, SEC-02)
- **D-04: Token guards ALL API requests (reads + writes), not just mutations.** Stronger than the literal SEC-02 wording — closes read-side info leaks to other local tabs. **Static assets** (the bootstrap HTML/JS) stay unguarded so the browser can load the SPA.
- **D-05: Token flow = URL `?t=<token>` → SPA reads query param once → sends `x-gsd-token` header on every API `fetch`.** Open `http://127.0.0.1:PORT/?t=<token>`; the SPA keeps the token in memory and attaches it as a **header** (not a query param) on API calls so it never lands in server request logs. Per-launch random token via `crypto.randomUUID()`.
- **D-06: Both Host-allowlist AND Origin/CORS checks.** Reject requests whose `Host` header isn't in the loopback allowlist (`127.0.0.1:PORT`, `localhost:PORT`) — DNS-rebinding defense — **and** reject cross-origin requests via an Origin/Referer check (`@fastify/cors` locked to the loopback origin). Belt-and-suspenders per CLAUDE.md "What NOT to use"; success criterion 2 tests both the Host-header and cross-origin cases.

### Snapshot store (SAVE-04)
- **D-07: Store in the OS-conventional per-user app-data dir (env-paths style), never inside the tracked project or its `.git`.** Windows `%APPDATA%`, `*nix` XDG/`~/.local/share` / macOS `~/Library`. One **path-hashed subfolder per tracked config**. (Research §Data Ownership: app-owned dir, never in a tracked project.)
- **D-08: Full-JSON snapshots + `index.json` per config.** One full JSON file per snapshot (KB-scale configs — cheap), plus an `index.json` listing entries. Diff/revert computed **on-demand** in Phase 5. Chosen over a diff-chain to avoid reconstruction/chain-corruption risk on a data-safety-critical tool (research §Pattern 4).
- **D-09: Design the index for pruning/de-dupe now.** Bake **sequence number + timestamp + content hash** into every `index.json` entry from day one, so keep-last-N / keep-milestones pruning and skip-identical-save de-dupe can be added later **without an on-disk format migration** (research §Scale flags unbounded history as the likely future friction). Pruning UI itself is out of scope for this phase.

### Snapshot pipeline integration (SAVE-04, builds on Phase 1)
- **D-10: Server-layer `saveWithSnapshot()` wrapper — Phase 1's frozen `saveConfig` stays untouched.** The wrapper orchestrates: read current on-disk content → call `saveConfig` (unchanged) → on success, record the snapshot. Snapshotting is a **server concern**, not a change to the frozen `config-io` barrel. Phase 5's revert must reuse this same wrapper (revert-as-write, no special-case path).
- **D-11: Pre-write snapshot of the CURRENT on-disk content** (research §Pattern 4: "snapshot BEFORE overwrite"). History = every prior state; revert restores a known-good past. The **first-ever save of a brand-new file** has nothing to snapshot — skip gracefully (no phantom entry).
- **D-12: Snapshot failure is non-fatal.** The config write is the user's actual intent and the source of truth. If snapshot recording fails (e.g. app-data disk error), the **save still commits** and the API surfaces a non-blocking "history not recorded" warning. History bookkeeping must never block a valid save.

### Claude's Discretion (research/planner decides)
- **REST API route shape** the Phase 3 UI will call (list/load/save/track endpoints, response envelope like `{ ok, snapshotId, errors }`) — design deliberately since Phase 3 builds against it, but the specific route naming is open.
- **Dev-vs-prod static serving** — how `@fastify/static` serves the built Vite `dist/client` in production vs. proxying Vite's dev server in development.
- **UI-bundling mechanics for DIST-03** — Phase 3 builds the actual screens, so Phase 2 establishes the packaging pipeline (`bin` + shebang, `tsup` for the CLI, `files`/`npm pack --dry-run` verification, `dist/client` inclusion). A placeholder/minimal served page is acceptable for Phase 2 verification.
- **Exact env-paths / app-data library choice** (e.g. `env-paths`) and path-hashing scheme (e.g. sha256 of the absolute config path) — pick a standard, cross-platform approach.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 frozen contracts (build against, do not modify)
- `packages/config-io/src/index.ts` — the **frozen public API barrel**. `saveConfig`, `writeWithRetry`, `ValidationError`, `load`, `createValidator`, `formatErrors`, `buildAjvSchema`, `safeSet`, discovery + merge exports, and the frozen data types. Adding/renaming exports here is an expensive downstream change.
- `packages/config-io/src/atomic-write.ts` — `saveConfig(path, obj, validate)` = `lock → validate → atomic write-with-retry → release`; `writeWithRetry` (Windows EPERM/EBUSY/EACCES retry). The `saveWithSnapshot` wrapper (D-10) composes these **without** editing them.
- `.planning/phases/01-schema-foundation-data-layer-safety/01-CONTEXT.md` — Phase 1 decisions; note the deferred item: "atomic-write pipeline shaped so snapshot-on-write and revert-as-write hook in without a special-case path" — Phase 2 delivers that hook.

### Architecture & security patterns (read before planning)
- `.planning/research/ARCHITECTURE.md` — §Pattern 1 (Local Loopback Service: `listen(0, '127.0.0.1')`, per-launch token, `x-gsd-token` middleware), §Pattern 4 (Full-Snapshot store with revert-as-write, "snapshot BEFORE overwrite"), §Data Ownership (app-owned dir never inside a tracked project), §Scale (index designed for pruning: seq + timestamp + content hash).
- `.claude/CLAUDE.md` — locked stack: Fastify 5.10.0, Commander 15.0.0, `@fastify/static` 10.1.0, `@fastify/cors` 11.3.0, `open` 11.0.0, `tsup` 8.5.1, `write-file-atomic@7.0.1` (pinned), `proper-lockfile` 4.1.2. Also "What NOT to Use": bind 127.0.0.1 + token + Origin/Host check (never loopback-binding alone); `bin` + shebang (no `pkg`/SEA).
- `.planning/research/PITFALLS.md`, `.planning/research/STACK.md`, `.planning/research/SUMMARY.md` — build-order and pitfall context.
- `.planning/REQUIREMENTS.md` — DIST-01..04, SEC-01, SEC-02, SAVE-04 (exact requirement wording).
- `.planning/ROADMAP.md` §Phase 2 — goal + 5 success criteria this phase is verified against.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/config-io` (Phase 1) — full read/write/validate/merge data layer already built and tested. Phase 2's server is essentially an HTTP + security + snapshot shell **around** this package.
- `saveConfig` / `writeWithRetry` / `ValidationError` — the exact primitives `saveWithSnapshot` (D-10) wraps.

### Established Patterns
- **Monorepo `packages/` layout** already in place (`config-io`, `schema-data`). New Phase 2 code (CLI/launcher, server, snapshot store) should follow this as additional packages (e.g. `packages/cli`, `packages/server`, snapshot module) rather than a flat `src/`.
- Pinned stack in `package.json` (Ajv 8.20, `write-file-atomic@7.0.1`, `proper-lockfile`, TS 5.9.3, vitest 4.1.10, tsx). Add Phase 2 deps at the CLAUDE.md-pinned versions.
- `proper-lockfile` already a dependency — reuse for any advisory locking; SIGINT handler (D-03) must release these on shutdown.

### Integration Points
- **The REST API contract** becomes the frozen surface Phase 3's UI builds against — design deliberately (Claude's Discretion above).
- **`saveWithSnapshot` + the snapshot store** become the surface Phase 5's version-history UI (browse/diff/revert) builds against — revert routes through the same wrapper.
- The **packaging pipeline** (bin/shebang, tsup CLI build, `dist/client` bundling) is the surface Phase 3's built UI drops into for DIST-03.

</code_context>

<specifics>
## Specific Ideas

- User explicitly chose to **honor the locked CLAUDE.md stack (Fastify + Commander)** over the research doc's lighter-weight sketch where the two conflicted — the researched, robust stack wins.
- Security posture is deliberately **stricter than the literal requirement**: token on all routes (not just mutations), and both Host + Origin checks (not just Host).
- Data-safety instinct carried from Phase 1: the **user's save always wins** — snapshot failures degrade to a warning, never block the write.

</specifics>

<deferred>
## Deferred Ideas

- **Single-instance / focus-existing-instance UX** (detect a running launch in the same project and reuse it) — explicitly declined for Phase 2 (D-03); could revisit as a later polish item if double-launch becomes a real annoyance.
- **Snapshot pruning/compaction UI** (keep-last-N, keep-milestones) — index format is designed to support it now (D-09), but the pruning feature itself is future work (Phase 5+ / a later milestone).
- **Version-history browse / diff / revert** — Phase 5 (SAVE-05, SAVE-06). Phase 2 only builds the store + pre-write snapshot pipeline it sits on.
- **The actual schema-driven UI screens** — Phase 3. Phase 2 provides only the server, security, packaging pipeline, and (at most) a placeholder served page.

None of the above are in Phase 2 scope — discussion stayed within phase boundary.

</deferred>

---

*Phase: 2-Local Loopback Server, CLI & Security Hardening*
*Context gathered: 2026-07-12*
