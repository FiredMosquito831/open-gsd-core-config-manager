# External Integrations

**Analysis Date:** 2026-07-31

## APIs & External Services

**GitHub REST API (open-gsd/gsd-core schema refresh):**
- Purpose: Live check for new upstream gsd-core releases; downloads the release source tarball to build a refreshed canonical config schema proposal.
- Client: Node's built-in global `fetch` (no SDK package).
- Implementation: `packages/server/src/schema-refresh-service.ts` (`SchemaRefreshService`). Endpoints called:
  - `GET https://api.github.com/repos/open-gsd/gsd-core/releases/latest` — finds the latest stable release (`tag_name`, rejects draft/prerelease).
  - `GET https://api.github.com/repos/open-gsd/gsd-core/git/ref/tags/{tag}` — resolves the tag to a commit (follows annotated-tag dereference up to 2 hops).
  - `GET https://api.github.com/repos/open-gsd/gsd-core/git/tags/{sha}` — dereference step for annotated tags.
  - `GET https://api.github.com/repos/open-gsd/gsd-core/tarball/{commit}` — downloads the gzip tar archive of the pinned commit.
- Headers: `Accept: application/vnd.github+json`; timeouts via `AbortSignal.timeout(15_000)` (JSON) / `30_000` (tarball bytes).
- Auth: No token — public repo, unauthenticated API (subject to GitHub's unauthenticated rate limits). There is NO `GITHUB_TOKEN` support.
- Error handling: Any non-ok response or parse failure collapses to a staged failure result (`packages/server/src/routes/schema.ts` returns HTTP 422 with a fixed message). The tarball is inspected in-memory without extraction — `packages/server/src/upstream-archive.ts` (`inspectPinnedArchive`) hand-parses the tar format with strict limits (compressed <= 8 MiB, decompressed <= 32 MiB, 4096 entries, depth 12, path-safety checks) and retains only 4 required files:
  - `gsd-core/bin/shared/config-schema.manifest.json`
  - `gsd-core/bin/shared/config-defaults.manifest.json`
  - `gsd-core/bin/lib/capability-registry.cjs` (parsed as a data literal via `packages/server/src/capability-registry-parser.ts`, NEVER executed — it uses the TypeScript compiler API `ts.createSourceFile` to read the AST)
  - `docs/CONFIGURATION.md` (evidence-extracted via `packages/server/src/documentation-evidence-parser.ts`)
- Production refresh produces a reviewable `SchemaProposal` (5-minute expiry) that the user activates via `POST /api/schema/proposals/:id/activate`. The refreshed schema is persisted by `packages/server/src/schema-persistence.ts` (`<appDataRoot>/schema/active-override.json`).

**OS Native File/Folder Picker (local subprocess):**
- Purpose: Open a real OS dialog so the SPA can receive an absolute path (browsers cannot leak absolute paths to HTTP-served pages).
- Client: `node:child_process.spawn`, no npm package.
- Implementation: `packages/server/src/picker.ts` (`pickFile`, `pickDirectory`) + routes in `packages/server/src/routes/picker.ts`. Backend chosen by PATH probing (cached per backend), NOT by `process.platform`:
  - Windows / WSL2-with-interop: `powershell.exe -NoProfile -NonInteractive -Command <System.Windows.Forms dialog script>`; WSL paths translated with `wslpath -u`.
  - macOS: `osascript -e 'POSIX path of (choose file|choose folder)'`.
  - Linux: `zenity --file-selection` or `kdialog --getopenfilename/--getexistingdirectory`.
- Diagnostic endpoint: `GET /api/picker/status` returns `{ supported, backend }`.

## Data Storage

**Databases:**
- None. No SQL/NoSQL database. All persistence is flat JSON files on the local filesystem.

**File Storage (local filesystem only):**
- GSD project configs: any `.json` file the user tracks via the sidebar (typically `<project>/.planning/config.json`). Read/written through `packages/config-io/`.
- Global defaults layer: `$GSD_HOME || ~/.gsd/defaults.json` (`packages/config-io/src/discovery.ts`).
- OS app-data directory (`env-paths('gsd-config-manager', { suffix: '' }).data` — Windows `%LOCALAPPDATA%`, Linux XDG, macOS `~/Library`), used by:
  - `workspace/configs.json` — persisted tracked-config sidebar list (`packages/server/src/workspace-store.ts`)
  - `snapshots/<sha256(absPath)>/` — full-JSON version history: `<seq>.json` snapshots + `index.json` index (`packages/server/src/snapshot-store/`)
  - `schema/active-override.json` — activated refreshed schema (`packages/server/src/schema-persistence.ts`)
- OS temp dir (`os.tmpdir()`): `gsd-config-manager-save-locks/<sha256>.lock` cross-process transaction locks (`packages/server/src/snapshot-store/save-with-snapshot.ts`).

**Caching:**
- In-memory only. No external cache (Redis/Memcached/etc.).
- React Query default `staleTime: 1000 * 30` (`web/src/state/queryClient.ts`).
- Picker backend probe results cached in a module-level Map (`packages/server/src/picker.ts` `hasCommandCache`).

## Authentication & Identity

**Auth Provider:**
- None (no OAuth, no accounts). Security is a per-launch loopback token model:
  - `createLaunchContext()` mints `crypto.randomUUID()` per launch (`packages/server/src/context.ts`).
  - The token is embedded in the auto-opened URL (`http://127.0.0.1:<port>/?t=<token>`), consumed by `web/src/bootstrap/token.ts`, and sent as the `x-gsd-token` header on every `/api` request (`web/src/api/client.ts`).
  - Server-side guards in `packages/server/src/plugins/`:
    - `host-guard.ts` — root-scope Host allowlist (DNS-rebinding defense for static + API).
    - `origin-guard.ts` — `/api`-scoped exact-Origin 403 rejection.
    - `token-guard.ts` — `/api`-scoped constant-time (`timingSafeEqual`) token check.
    - `cors.ts` — exact-string CORS origin lock, `credentials: false`.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry/Bugsnag/etc.

**Logs:**
- Fastify logger defaults to OFF (`app.ts` builds with `logger: opts.logger ?? false`). The CLI's stdout banner is the user-facing channel; unexpected errors are routed to a `warn` sink (`console.warn` default) via `app.setErrorHandler`. Error responses to clients are always fixed, static, path-free messages (information-disclosure guard).

## CI/CD & Deployment

**Hosting:**
- No hosted server. The app runs entirely on the user's local machine as a loopback helper + browser UI.

**CI Pipeline:**
- None detected. No `.github/workflows/`, no `.gitlab-ci.yml`, no other CI config. All checks run locally via `npm test` / `npm run typecheck`.

**Distribution:**
- Published to npm as `gsd-config-manager`; launch via `npx gsd-config-manager`. `prepublishOnly` runs the full build. `package.json` `files` allowlist ships only `dist/cli.js` + `dist/client/**`.

## Environment Configuration

**Required env vars:**
- None required for runtime. The server binds `127.0.0.1` with an OS-assigned port and auto-opens the browser; no API keys or tokens are needed.

**Optional env vars:**
- `GSD_HOME` — overrides `os.homedir()` for global-defaults discovery (`packages/config-io/src/discovery.ts`) and the build-time schema source (`packages/schema-data/scripts/build-schema.ts`).
- `NO_COLOR` — consumed only by `scripts/launch-pty.py` (stripped before spawning).

**Secrets location:**
- Not applicable — there are no persistent secrets, API keys, or credentials. The per-launch token is memory-only and never persisted. `.env` files: none present.

## Webhooks & Callbacks

**Incoming:**
- None. No webhook endpoints.

**Outgoing:**
- None. The only outbound network call is the user-initiated GitHub schema refresh (see "APIs & External Services"). No webhook registration.

## Other Local-Environment Integrations

**Browser auto-open:**
- `open` package (`packages/cli/src/bootstrap.ts`) launches the default browser at the tokenized loopback URL. The call is wrapped in try/catch — a headless box / WSL-without-interop must not kill the server. `--no-open` disables it.

**Build-time local gsd-core source (maintainer-only):**
- `npm run build:schema` (`packages/schema-data/scripts/build-schema.ts`) reads a LOCAL gsd-core installation at `$GSD_HOME || ~/.claude/gsd-core/bin` — `shared/config-schema.manifest.json`, `shared/config-defaults.manifest.json`, `lib/capability-registry.cjs` — to reconcile the shipped `bundled-schema.json`. This is a trusted-local maintainer step (executes the local capability registry via `require`), distinct from the untrusted remote refresh path (which only AST-parses the same file shape). The prebuilt `packages/schema-data/bundled-schema.json` is committed, so normal builds don't need a local gsd-core.

**Test-only external tools:**
- `scripts/launch-pty.py` uses a POSIX PTY to launch `dist/cli.js` and capture the banner URL (WSL/Linux dev).
- `test/server/schema-refresh-live.test.ts` exercises the real GitHub API (network-dependent; likely gated/skipped when offline).

---

*Integration audit: 2026-07-31*
