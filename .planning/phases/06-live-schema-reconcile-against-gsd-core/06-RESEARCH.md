# Phase 6: Live Schema Reconcile Against gsd-core - Research

**Researched:** 2026-07-20
**Domain:** Secure, local schema refresh and reconciliation from a pinned gsd-core release
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** A normal refresh targets the **latest stable published gsd-core release** only. Do not follow the repository default branch, the prerelease/`next` channel, the locally installed version, or an arbitrary user-selected release.
- **D-02:** Resolve the latest stable release to immutable identity metadata and fetch its pinned tagged archive. Record at least the upstream release version and immutable commit/archive identity so every proposal and active schema is traceable.
- **D-03:** Apply strict network and archive limits and inspect only an explicit allowlist of expected schema/documentation files. Remote JavaScript/CommonJS/TypeScript is never imported, required, evaluated, or executed; any needed information must be extracted by a constrained data parser.
- **D-04:** Refresh is fail-closed. If any required source is absent, malformed, exceeds limits, identifies a conflicting release, or fails consistency/validation checks, produce no activatable proposal and leave the active schema unchanged. Errors must be actionable but must not expose local paths or raw internals.
- **D-05:** Compute normalized semantic differences, ignoring formatting and key-order noise. First-class review changes include key presence, type, allowed values/options, defaults, dynamic shape/pattern metadata, deprecation state, and relevant upstream documentation changes.
- **D-06:** A key absent from the new stable release is retained in the proposed schema as **deprecated**, with source-version evidence, rather than immediately removed. This keeps older project configs recognizable and documented instead of turning those fields into unexplained unknown keys.
- **D-07:** Curated `x-description`, category, option explanations, and source-confirmed specialized-editor metadata remain authoritative and are never blindly overwritten. When corresponding upstream prose changes, preserve the active curated text and visibly flag documentation drift for later editorial attention.
- **D-08:** Review presents a grouped summary of added, changed, and deprecated keys plus expandable per-key evidence. The user accepts and activates the entire validated proposal or cancels it; there are no per-category or per-key hybrid merges.
- **D-09:** Fetch/reconcile creates an inert proposal only. A separate explicit **Activate** action switches both schema rendering and authoritative server-side validation to the same already-validated proposal atomically.
- **D-10:** An accepted refreshed schema persists in application data across helper launches. It never modifies a tracked project, the installed gsd-core package, or the npm package's bundled artifact.
- **D-11:** The bundled schema remains an immutable recovery baseline. On startup, compare recorded upstream source versions and use whichever valid schema—bundled or persisted refresh—targets the newer stable gsd-core version; an older persisted refresh must not shadow a newer package bundle.
- **D-12:** Provide an explicit **Reset to bundled schema** control that atomically removes/deactivates the persisted override and returns both renderer and validator to the shipped baseline. Multi-version schema history is out of scope.
- **D-13:** Validate, normalize, and successfully compile a proposal with the project validator before it can be activated or persisted. Persist schema plus metadata atomically so interrupted writes cannot produce a half-updated active state.
- **D-14:** If a persisted override is corrupt, incompatible, or fails compilation at startup, safely fall back to the bundled schema, quarantine or ignore the invalid override, and show a persistent actionable warning. Do not block startup or fail silently.
- **D-15:** Schema maintenance is an **app-wide dedicated workspace**, not a selected config's schema chapter and not a modal. Enter it through a persistent utility/status affordance; retain the tracked-config sidebar for orientation but hide config chapter navigation while the workspace is active.
- **D-16:** During ordinary editing, show a compact persistent indicator with active source (`Bundled` or `Refreshed`), gsd-core source version, and accepted/refreshed date. Activating the indicator opens the schema workspace.
- **D-17:** The workspace follows a staged flow: check/fetch latest stable → validate and reconcile → show grouped summary and expandable evidence → explicit Activate or Cancel. Fetching alone never changes the active schema.
- **D-18:** If latest stable produces no semantic differences, show a clear up-to-date confirmation with the checked gsd-core version and check time, retain the current schema without a no-op activation, and update last-checked status separately from last-activated/refreshed status.

### Claude's Discretion

- Exact workspace layout, responsive breakpoints, icons, progress treatment, normalized diff presentation, filters, evidence expansion behavior, status wording, timestamp formatting, and warning copy are open to design/research, provided the staged and fail-closed interaction model above is preserved.
- Exact endpoint names, app-data filenames, proposal lifetime/expiry, archive limits, retry policy, and parser libraries are open to research and planning. They must preserve the existing secured `/api` boundary, frozen response envelopes, package portability, atomic activation, and remote-code non-execution contract.

### Deferred Ideas (OUT OF SCOPE)

- Scheduled or automatic background schema refresh and changelog prompts (`AUTO-01`, v2).
- Prerelease/`next` channel support, installed-version targeting, arbitrary stable-release selection, and rollback to multiple historical refreshed schemas.
- Per-key or per-change-group merge selection and in-app editing of curated documentation.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-05 | User can refresh/reconcile the canonical schema from the open-gsd/gsd-core repository, seeing added/changed/deprecated keys, without losing curated descriptions. | A pinned-release acquisition pipeline, inert source parsers, normalized reconciliation/diff model, atomic active-schema manager, guarded REST lifecycle, and dedicated client workspace are specified below. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use React + Vite + TypeScript for the frontend and a Node local helper; do not add a hosted service. [VERIFIED: .claude/CLAUDE.md]
- Keep the helper bound to loopback and preserve the existing per-launch token and Origin/Host protections for all new `/api` operations. [VERIFIED: .claude/CLAUDE.md]
- Preserve data safety: validate before atomic write and preserve a recovery path. [VERIFIED: .claude/CLAUDE.md]
- Keep every canonical key representable/documented and track evolving gsd-core schema. [VERIFIED: .claude/CLAUDE.md]
- Use Ajv as the sole schema-validation language; do not introduce Zod or Valibot as a second validator. [VERIFIED: .claude/CLAUDE.md]
- Do not bind the server to `0.0.0.0`; do not trust loopback binding alone. [VERIFIED: .claude/CLAUDE.md]
- Do not use remote CommonJS/JS/TS execution as part of refresh. [VERIFIED: 06-CONTEXT.md]
- Package `dist/cli.js` and `dist/client/**` must continue to work from an extracted npm tarball without a runtime source-tree dependency. [VERIFIED: package.json]

## Summary

Implement refresh as a server-owned, staged transaction: resolve GitHub’s latest release, reject draft/prerelease/non-semver identities, resolve its release tag to an immutable commit, download that commit’s tarball with hard resource caps, and inspect only four allowlisted entries. The currently verified stable release is `v1.7.0`, published 2026-07-15; its immutable tag resolves to commit `b1c9381b7abbf443f16c197118236b45cdd0486a`. Its schema paths are `gsd-core/bin/shared/config-schema.manifest.json`, `gsd-core/bin/shared/config-defaults.manifest.json`, `gsd-core/bin/lib/capability-registry.cjs`, and `docs/CONFIGURATION.md`. This observation must remain runtime-configured as an exact allowlist, not a claim that the layout cannot change. [VERIFIED: GitHub REST API and stable release/tree inspection]

The local builder already holds the desired reconciliation rules, but it `require()`s a trusted local capability registry. Extract its source-independent pure reconciliation into a shared module, then add a separate constrained AST extractor for remote `capability-registry.cjs`: parse text with the already-installed TypeScript compiler and accept only the exact `const configSchema = { ...literal data... }` subset. Reject every expression that is not a supported literal/object/array form; never import, require, evaluate, or execute the downloaded file. [VERIFIED: packages/schema-data/scripts/build-schema.ts; CITED: https://github.com/microsoft/TypeScript]

An activation must replace one in-memory `{ schema, validator, metadata }` snapshot only after normalization and Ajv compilation succeed. Persist that exact snapshot as one atomic app-data document, then swap the manager reference; all loads, saves, history restores, schema GETs, and client rendering must read that manager rather than module-level bundled globals. This is the only way to avoid renderer/server-validator drift. [VERIFIED: packages/server/src/schema.ts; packages/server/src/routes/configs.ts; packages/server/src/routes/history.ts; web/src/components/editor/ConfigEditor.tsx]

**Primary recommendation:** Build an injected `ActiveSchemaManager` plus a fail-closed `SchemaRefreshService`; acquire a commit-pinned tarball, parse only inert allowlisted data, reconcile through shared pure logic, review an inert proposal, and atomically activate/persist the compiled snapshot.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve latest stable release and pinned archive | API / Backend | External GitHub API | The browser must never choose arbitrary refs/URLs or handle trust decisions. |
| Archive limits and inert source parsing | API / Backend | — | Network bytes, archive entries, AST restrictions, and error redaction are a privileged trust boundary. |
| Normalize, reconcile, compile, persist, and activate | API / Backend | Database / Storage | The server owns the authoritative validator and OS app-data atomic persistence. |
| Bundled-versus-override startup selection | API / Backend | Database / Storage | Startup must safely compile persisted state and fall back without blocking the UI. |
| Status indicator, proposal review, and activation controls | Browser / Client | API / Backend | The client presents server-computed evidence; it cannot activate from local data. |
| Reindex/reload editor after switch | Browser / Client | API / Backend | React Query must obtain the newly active descriptor and fresh effective config state. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node built-in `fetch`, `AbortSignal`, `node:crypto`, `node:zlib` | Node `>=20.19` | Pinned GitHub request, timeout, response hash, gzip decoding | Existing Node floor includes global fetch; `AbortSignal.timeout()` and streamed response consumption avoid another HTTP client. [CITED: https://nodejs.org/api/globals.html] |
| TypeScript compiler API | `5.9.3` (existing dev dependency) | Parse remote CommonJS as AST, never execute it | `createSourceFile` creates an AST; strict node-kind checks can admit only literal `configSchema` data. [CITED: https://github.com/microsoft/TypeScript] |
| Ajv + existing `buildAjvSchema` / `createValidator` | `8.20.0` | Proposal compile gate and server validation | The project’s one schema language and authoritative validator already compile flat descriptors. [VERIFIED: packages/config-io/src/schema-convert.ts; packages/config-io/src/validate.ts] |
| `write-file-atomic` | `7.0.1` (existing) | Persist active override envelope | Existing retrying wrapper fsyncs and renames a same-directory temporary file. [VERIFIED: packages/config-io/src/atomic-write.ts] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tar` | `7.5.20` [WARNING: flagged as suspicious — verify before using.] | Stream and inspect a gzip tarball without extracting it | Use only after a human legitimacy checkpoint; reject every link and every non-allowlisted entry, and never write archive files to disk. Its official repository recommends filtering links for untrusted tarballs. [CITED: https://github.com/isaacs/node-tar] |
| TanStack React Query | `5.101.2` (existing) | Schema status/proposal mutations and cache invalidation | Use existing token-aware client wrapper and invalidate `['schema']` plus active config after activation/reset. [VERIFIED: package.json; web/src/api/client.ts] |
| Zustand | `5.0.14` (existing) | Global `schema` workspace mode and transient proposal review state | Extend the established `editor`/`history` dedicated-workspace state. [VERIFIED: web/src/state/uiStore.ts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pinned GitHub tarball | GitHub Contents/Tree/Blob APIs | This avoids tar parsing but contradicts D-02’s pinned tagged archive decision; do not use as the production fetch path. |
| AST extraction | `require()` / `import()` of registry | Remote code execution violates D-03; never use it. |
| AST extraction | Regex extraction | Nested literals, comments, strings, and formatting make regex brittle and unsafe; reject unsupported AST nodes instead. [ASSUMED] |
| One active snapshot document | Separate schema and metadata files | A crash can leave mismatched data; persist the schema and identity/status metadata in one atomic envelope. [VERIFIED: 06-CONTEXT.md] |

**Installation:**
```bash
npm install tar@7.5.20
```
Only install after the required human legitimacy checkpoint approves `tar`; it is the sole new package recommended for this phase. [WARNING: flagged as suspicious — verify before using.]

**Version verification:** `npm view tar version time` returned `7.5.20`, published 2026-07-12; no `postinstall` script was returned. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `tar` | npm | Created 2011; latest `7.5.20` published 2026-07-12 | 93,810,612 weekly | github.com/isaacs/node-tar | SUS (`too-new` signal for latest publish) | Flagged — planner must add `checkpoint:human-verify` before install |

**Packages removed due to [SLOP] verdict:** none.

**Packages flagged as suspicious [SUS]:** `tar` — the planner must insert `checkpoint:human-verify` before `npm install tar@7.5.20`.

## Architecture Patterns

### System Architecture Diagram

```text
Schema workspace UI
  │ GET status / POST refresh
  ▼
Guarded local /api routes ── token + Origin + Host guards ──► SchemaRefreshService
                                                             │
                                                             ├─ GET GitHub latest release
                                                             ├─ validate stable release/tag
                                                             ├─ resolve tag → immutable commit
                                                             ├─ fetch tarball/<commit> with caps + SHA-256
                                                             ├─ stream-inspect allowlisted entries only
                                                             │     ├─ JSON.parse manifests/defaults
                                                             │     ├─ TypeScript AST literal extractor (registry)
                                                             │     └─ documentation fingerprint extractor
                                                             ▼
                                                        Shared pure reconciler
                                                             │ curated docs + specialized catalog win
                                                             ▼
                                                  normalize → semantic diff → Ajv compile
                                                             │
                         no semantic change ─────────────────┤──► update lastChecked only
                         invalid/error ───────────────────────┤──► discard proposal; active unchanged
                                                             ▼
                                              inert in-memory proposal + review evidence
                                                             │ POST activate
                                                             ▼
                                  atomic persisted override envelope + ActiveSchemaManager swap
                                                             │
                                      GET /api/schema, config load/save, restore use same snapshot
                                                             ▼
                        client invalidates schema/config queries → rebuilds index/renders active schema
```

### Recommended Project Structure

```text
packages/
├── schema-data/
│   ├── src/reconcile.ts              # pure structural extraction → overlay → normalization
│   ├── src/source-types.ts           # manifest/input/provenance contracts
│   ├── curated-docs.json             # immutable curated prose overlay
│   ├── specialized-catalog.json      # immutable specialized-editor evidence
│   └── bundled-schema-meta.json      # bundled gsd-core version/identity (new)
├── server/src/
│   ├── active-schema-manager.ts      # active snapshot, startup fallback, atomic switch/reset
│   ├── schema-refresh-service.ts     # GitHub acquisition, parsing, proposal lifecycle
│   ├── upstream-archive.ts           # capped allowlist-only archive inspection
│   ├── capability-registry-parser.ts # AST-to-literal constrained parser
│   ├── documentation-evidence-parser.ts # inert heading/anchor/key fingerprints
│   ├── schema-persistence.ts         # one-file override envelope + quarantine
│   └── routes/schema.ts              # status/refresh/proposal/activate/reset routes
web/src/
├── api/schema.ts                     # typed guarded calls
├── components/schema/SchemaWorkspace.tsx
├── components/schema/SchemaStatusControl.tsx
├── components/schema/SchemaChangeSummary.tsx
└── state/uiStore.ts                  # `schema` mode only; no privileged data
```

### Pattern 1: Immutable identity before content acquisition

**What:** Call `GET /repos/open-gsd/gsd-core/releases/latest`; require `draft === false`, `prerelease === false`, a stable semver tag, then resolve `refs/tags/<tag>` to a commit SHA (and dereference annotated tag objects if necessary). Fetch `GET /repos/open-gsd/gsd-core/tarball/<commitSHA>`, not the mutable branch/default `target_commitish`. Record release id, version/tag, commit SHA, requested archive URL, SHA-256, checked timestamp, and file blob hashes where available. GitHub documents the latest-release endpoint and recommends the `application/vnd.github+json` media type. [CITED: https://docs.github.com/en/rest/releases/releases]

**When to use:** Every manual refresh. Never accept a URL, owner, repo, ref, channel, or archive path from the browser.

**Example:**
```ts
// Source: GitHub REST docs and Node AbortSignal docs
const release = await fetchJson(LATEST_RELEASE_URL, { signal: AbortSignal.timeout(15_000) });
if (release.draft || release.prerelease || !isStableSemverTag(release.tag_name)) {
  throw new RefreshError('No stable release is available');
}
const commit = await resolveTagToCommit(release.tag_name);
const archive = await readCappedBody(
  `${GITHUB_API}/repos/open-gsd/gsd-core/tarball/${commit}`,
  MAX_COMPRESSED_BYTES,
);
const archiveSha256 = createHash('sha256').update(archive).digest('hex');
```

### Pattern 2: Inert, allowlist-only archive reader

**What:** Set explicit compressed-body, decompressed-entry, total decompressed, entry-count, path-depth, and timeout caps before parsing. Permit exactly the expected release-prefix-relative paths: `gsd-core/bin/shared/config-schema.manifest.json`, `gsd-core/bin/shared/config-defaults.manifest.json`, `gsd-core/bin/lib/capability-registry.cjs`, and `docs/CONFIGURATION.md`. Reject duplicate required paths, missing required paths, absolute/`..` paths, links, devices, directories masquerading as files, unsupported entry types, and every unexpected archive entry without reading/extracting its content. Do not extract to disk. Node-tar’s upstream documentation specifically recommends filtering all hard/symbolic links for untrusted tarballs. [CITED: https://github.com/isaacs/node-tar]

**When to use:** Exactly once after immutable identity resolution; dispose all bytes and parsed source after an accepted proposal is replaced/cancelled or a failure occurs.

**Limits:** Use a 15-second release request, 30-second archive request, 8 MiB compressed archive, 32 MiB total decompressed data, 1 MiB per required file, 4,096 entry count, and depth 12 as initial conservative defaults. These values are implementation recommendations, not upstream guarantees; expose none to the browser and make cap failures path-free. [ASSUMED]

### Pattern 3: Literal-only capability registry extraction

**What:** Use `ts.createSourceFile('capability-registry.cjs', text, ts.ScriptTarget.ES2022, false, ts.ScriptKind.JS)`. Require no parse diagnostics. Locate exactly one top-level declaration named `configSchema`; require its initializer to be an object literal. Recursively accept only object literals with identifier/string keys, arrays, string/numeric/boolean/null literals, and unary-minus numeric literals if the upstream data requires them. Reject spreads, computed keys, shorthand properties, getters/setters, calls, identifiers, property access, functions, templates, regexps, binary expressions, and every other node. Also require a finite maximum AST node count and source length. The TypeScript compiler API’s `createSourceFile` and node guards support AST inspection without module loading. [CITED: https://github.com/microsoft/TypeScript]

**When to use:** Only to obtain `configSchema`; it must not attempt to interpret the rest of the CommonJS file.

### Pattern 4: Reconcile curation after structural extraction

**What:** Refactor `build-schema.ts` so pure functions accept parsed local/remote source data and current active schema/overlays rather than reading paths or loading a capability registry. Build a sorted structural descriptor map from manifest keys, dynamic patterns, defaults, and AST-extracted `configSchema`; exclude upstream runtime-state keys. Apply local `curated-docs.json` and local source-confirmed specialized metadata last. For any current active key absent in the new upstream structural set, copy the active curated descriptor into the candidate and add additive lifecycle metadata such as `x-deprecated: true` and `x-deprecated-since: <new version>`. Do not remove it from validation/renderer coverage. [VERIFIED: packages/schema-data/scripts/build-schema.ts; 06-CONTEXT.md]

**When to use:** Candidate construction only. The build-time maintainer script should call the same pure reconciler but may retain trusted-local input adapters.

### Pattern 5: Normalize before diff; persist one validated snapshot

**What:** Define a canonical semantic projection for each key: `{present, type, enum(sorted), default, patternProperties(sorted recursively), xDynamicKeyHint, xDeprecated, upstreamDocumentationFingerprint}`. Compare stable JSON of those projections, not raw descriptor JSON. Keep curated prose/category/options/specialized metadata outside the structural change projection; calculate documentation drift independently from a stored upstream-prose fingerprint/hash. A proposal has `added`, `changed`, `deprecated`, and `documentationDrift` entries with old/new evidence. Compile the full candidate with `buildAjvSchema` + `createValidator` before proposal creation, then compile again on persisted-override load. [VERIFIED: packages/config-io/src/schema-convert.ts; packages/config-io/src/validate.ts]

**When to use:** For review and no-op detection. A prose-only upstream change is documentation drift, not permission to overwrite curation.

### Anti-Patterns to Avoid

- **Fetching `next`, default branch, local installation, or browser-supplied URLs:** violates D-01 and turns a maintenance action into arbitrary remote acquisition. [VERIFIED: 06-CONTEXT.md]
- **Using `require()` or dynamic `import()` for the downloaded registry:** code execution is prohibited even if the expected upstream currently appears trustworthy. [VERIFIED: 06-CONTEXT.md]
- **Using the current `build-schema.ts` unchanged against remote bytes:** its local `require(CAPABILITY_REGISTRY_PATH)` is explicitly a trusted-local exception. [VERIFIED: packages/schema-data/scripts/build-schema.ts]
- **Archive extraction to an app-data/temp directory:** it creates unnecessary symlink/TOCTOU/file-write exposure; inspect only selected stream entries in memory. [CITED: https://github.com/isaacs/node-tar]
- **Replacing the schema before review/compile/persist:** violates the inert-proposal and atomic-activation contract. [VERIFIED: 06-CONTEXT.md]
- **Letting persisted override metadata and schema live in independent files:** a crash can split identity and content. [VERIFIED: 06-CONTEXT.md]
- **Returning raw fetch/parse errors, archive names, URLs with tokens, or app-data paths:** existing API error policy requires static, path-free client messages. [VERIFIED: packages/server/src/app.ts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP transport/timeouts | Custom `http` redirect/request client | Node global `fetch` + `AbortSignal.timeout`, plus an explicit streaming byte counter | Existing Node runtime supports the primitives; application code need only enforce product-specific caps. [CITED: https://nodejs.org/api/globals.html] |
| JavaScript execution sandbox | VM, `eval`, `Function`, dynamic import, or `require` | TypeScript AST literal-only parser | A sandbox is unnecessary and harder to secure when no remote behavior is needed. [CITED: https://github.com/microsoft/TypeScript] |
| Tar format decoder | An unconstrained general TAR implementation | `tar@7.5.20` after human legitimacy approval; if rejected, a dependency-free bounded reader limited to frozen-official-fixture USTAR/PAX/GNU needs | Archive parsing has link/path corner cases; either branch must pass the same official-format and hostile fixture matrix before acquisition. [CITED: https://github.com/isaacs/node-tar] |
| JSON-schema compiler | Parallel ad-hoc validator | Existing Ajv conversion/validator | The active descriptor must drive both server validation and client feedback. [VERIFIED: packages/config-io/src/schema-convert.ts] |
| Atomic persistence | `writeFile` plus rename scripts | Existing `writeWithRetry` / `write-file-atomic` | Existing helper provides fsync and Windows retry behavior. [VERIFIED: packages/config-io/src/atomic-write.ts] |
| Structural diff | Text diff / raw JSON string compare | Stable semantic projections and explicit per-field equality | Key order and formatting must not create review noise under D-05. [VERIFIED: 06-CONTEXT.md] |

**Key insight:** the remote archive is untrusted transport, not a dependency. The application needs only a small, declarative evidence subset; never generalize this refresh feature into a repository runner or arbitrary downloader.

## Common Pitfalls

### Pitfall 1: Release tag is not enough identity
**What goes wrong:** A proposal records `target_commitish` or a tag URL but fetches the moving branch/ref later, so review evidence cannot be reproduced.
**Why it happens:** GitHub release JSON contains both a display tag and a branch-like `target_commitish`; release identity and content identity are different concepts. [CITED: https://docs.github.com/en/rest/releases/releases]
**How to avoid:** Resolve the exact tag object to a commit SHA before archive retrieval, fetch by SHA, hash the bytes, and verify archive layout/version evidence against the resolved release.
**Warning signs:** archive metadata version/tag disagrees with the release response, tag resolves to an unexpected object type, or proposed source cannot state a commit SHA.

### Pitfall 2: Trusted-local parser accidentally becomes a remote code runner
**What goes wrong:** Reusing `require(CAPABILITY_REGISTRY_PATH)` against an extracted remote `.cjs` executes arbitrary module top-level code.
**Why it happens:** Current `build-schema.ts` is a maintainer script and documents this as permitted only for a locally installed trusted gsd-core copy. [VERIFIED: packages/schema-data/scripts/build-schema.ts]
**How to avoid:** Split pure reconciliation from input adapters; remote adapter accepts literal AST data only and rejects on any unsupported syntax.
**Warning signs:** `createRequire`, `import()`, `vm`, `eval`, `Function`, child-process, or a remote file path appears outside the archive reader/parser tests.

### Pitfall 3: Tar traversal, links, and decompression exhaustion
**What goes wrong:** A crafted archive writes outside the target, consumes memory/CPU, or slips a symlink/hardlink into a later allowed file path.
**Why it happens:** Archive extraction has path/link and TOCTOU edge cases; node-tar advises rejecting links for untrusted input, and a 2026 advisory involved link-path sanitization. [CITED: https://github.com/isaacs/node-tar]
**How to avoid:** Never extract; reject all links and special entries; require path containment, exact allowlist membership, duplicate rejection, and compressed/decompressed/entry/time limits.
**Warning signs:** any filesystem extraction call, `preservePaths`, nonzero accepted link count, or absence of cap tests.

### Pitfall 4: Curation is overwritten by structural merge
**What goes wrong:** A refreshed upstream description/category/options replaces beginner-oriented curated text, or removed keys disappear into unknown-key handling.
**Why it happens:** Naively spreading incoming descriptor objects makes upstream text win.
**How to avoid:** Treat structural source fields and curated overlay fields as distinct; overlay curation last; retain removed keys as deprecated; compare upstream prose fingerprints separately. [VERIFIED: packages/schema-data/scripts/build-schema.ts; 06-CONTEXT.md]
**Warning signs:** changed descriptions after refresh without an editorial change, absent old keys in the proposed schema, or specialized metadata missing from a candidate.

### Pitfall 5: Validator and renderer read different schema generations
**What goes wrong:** A form renders a new key while save validates against the old module-cached validator, or vice versa.
**Why it happens:** `packages/server/src/schema.ts` currently keeps an immutable module constant and cached validator. [VERIFIED: packages/server/src/schema.ts]
**How to avoid:** Replace both getters with an injected manager that returns one immutable active snapshot. Swap only after persisted write succeeds; client invalidates `['schema']` and active config queries after mutation.
**Warning signs:** multiple schema/validator caches, route-local compilation, or activation that does not invalidate queries.

### Pitfall 6: Startup override failure blocks the entire helper
**What goes wrong:** Corrupt app-data JSON or a schema that no longer compiles prevents opening the editor.
**Why it happens:** Persisted state is external to a new package build and cannot be assumed compatible.
**How to avoid:** Parse, validate envelope, normalize, and compile inside a caught startup branch; atomically quarantine/ignore invalid data, choose the valid newer bundled baseline, and expose a persistent warning via status. [VERIFIED: 06-CONTEXT.md]
**Warning signs:** startup throws on override read, warnings only reach logs, or a corrupt fixture makes `buildApp()` reject.

## Code Examples

Verified patterns from official/project sources:

### Constrained AST conversion

```ts
// Source: TypeScript Compiler API docs; the accept-list is project policy.
import ts from 'typescript';

function readLiteral(node: ts.Expression): unknown {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((item) => {
    if (!ts.isExpression(item) || ts.isSpreadElement(item)) throw new ParseError('Unsupported registry data');
    return readLiteral(item);
  });
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map((property) => {
    if (!ts.isPropertyAssignment(property) || !property.name || ts.isComputedPropertyName(property.name)) {
      throw new ParseError('Unsupported registry data');
    }
    const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
      ? property.name.text : undefined;
    if (!key) throw new ParseError('Unsupported registry data');
    return [key, readLiteral(property.initializer)];
  }));
  throw new ParseError('Unsupported registry data');
}
```

### Atomic active snapshot swap

```ts
// Source: existing writeWithRetry and schema conversion/validator seams.
async function activate(proposal: Proposal): Promise<SchemaStatus> {
  const snapshot = compileActiveSnapshot(proposal.schema, proposal.metadata); // throws before write
  await overrideStore.writeAtomically({ version: 1, ...snapshot });
  activeSchemaManager.replace(snapshot); // one reference swap after durable write
  return activeSchemaManager.status();
}
```

### Client cache consistency after activation

```ts
// Source: existing React Query schema/config query keys.
const activate = useMutation({
  mutationFn: activateSchemaProposal,
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['schema'] });
    await queryClient.invalidateQueries({ queryKey: ['config', activeConfigId] });
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Local maintainer script reads installed manifests and `require()`s local registry | Pinned stable-release archive with inert literal extraction | Phase 6 | Reuse pure reconciliation but introduce a hard remote trust boundary. [VERIFIED: packages/schema-data/scripts/build-schema.ts; 06-CONTEXT.md] |
| Bundle-only immutable schema and module-cached validator | Validated bundled baseline plus one persisted active override selected by version | Phase 6 | Manager replaces global immutable getter while retaining bundle-safe fallback. [VERIFIED: packages/server/src/schema.ts; 06-CONTEXT.md] |
| Editor/history workspace modes | Editor/history/schema app-wide workspace modes | Phase 6 | Generalize the existing shell rather than adding a selected-config chapter/modal. [VERIFIED: web/src/components/AppShell.tsx; web/src/state/uiStore.ts; 06-CONTEXT.md] |

**Deprecated/outdated:**
- Treating `packages/server/src/schema.ts`’s `getBundledSchema()` and module-level cached validator as the active authority is no longer sufficient once schema activation is runtime mutable. Replace callers with the active manager, while retaining `getBundledSchema()` as a baseline-only accessor if useful. [VERIFIED: packages/server/src/schema.ts]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Initial caps of 8 MiB compressed, 32 MiB decompressed, 1 MiB/file, 4,096 entries, depth 12, and 15/30-second timeouts are appropriate. | Architecture Pattern 2 | Limits may reject a legitimate future release or fail to provide desired resource protection; confirm/tune with maintainers. |
| A2 | Regex extraction is intrinsically too brittle for the allowed CommonJS data shape. | Alternatives | Low; AST parser remains the recommended secure path regardless. |

## Resolved Decisions

1. **Bundled baseline identity is generated at build time and shipped.**
   - Add checked-in `packages/schema-data/bundled-schema-meta.json`, generated/updated with the schema build and included in the package. It records stable `gsdCoreVersion`, tag, immutable commit/archive identity when available, and generation timestamp; build/completeness validation fails when required stable identity is missing or malformed. Existing provenance that cannot be proven is represented as absent, never invented. [RESOLVED: planner/checker decision; supports D-02 and D-11]

2. **A same-version different-commit/archive identity is a fail-closed identity conflict.**
   - Neither acquisition nor startup may create, activate, or select the conflicting override/proposal. Runtime remains on the valid bundled baseline and exposes the persistent safe warning. Equal semver is not permission to prefer refreshed content when immutable provenance differs. [RESOLVED: planner/checker decision; supports D-04, D-11, and D-14]

3. **Tar legitimacy and fallback are resolved by mandatory Plan 06-01 checkpoint branches.**
   - `approve-tar` permits only exact `tar@7.5.20` after provenance/advisory review and inspection-only use.
   - `reject-tar` requires a dependency-free bounded reader that passes a frozen fixture captured from the official commit-pinned GitHub archive format. It may implement only the exact PAX/GNU metadata records demonstrated by that fixture, with bounded record length/count and immediate-next-entry application, while rejecting links, unsafe paths, special/sparse entries, duplicates, unsupported records, malformed checksums/padding, and every cap/time violation.
   - If exact safe official-format support cannot be proven, execution stops and escalates for a new human decision before acquisition/proposal work. It must not proceed with a branch that cannot consume the official archive format or reduce SCHEMA-05. [RESOLVED: mandatory human checkpoint contract; supports D-02 through D-04]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | fetch, TypeScript AST, gzip, server | ✓ | v22.22.0 | Project floor is `>=20.19` |
| npm | `tar` checkpoint/install and test commands | ✓ | 10.9.4 | — |
| GitHub HTTPS API | User-triggered live refresh | ✓ during research | Latest stable observed `v1.7.0` | Fail closed with actionable offline/transport status; bundled schema remains active |
| Git | Research-only source inspection | ✓ | 2.43.0 | Not a runtime dependency; do not shell out to it |

**Missing dependencies with no fallback:** none for development. Runtime GitHub network absence intentionally prevents only refresh, not normal editing. [VERIFIED: 06-CONTEXT.md]

**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.10` [VERIFIED: package.json] |
| Config file | `vitest.config.ts` [VERIFIED: repository file inventory] |
| Quick run command | `npm run test:ordinary -- --run test/server/schema-route.test.ts test/schema-data/completeness.test.ts` |
| Full suite command | `npm test && npm run typecheck && npm run build && npm pack --dry-run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHEMA-05 | Stable-release client rejects prerelease/draft/malformed/tag conflict and never creates a proposal | unit | `npx vitest run test/server/schema-refresh.test.ts -x` | ❌ Wave 0 |
| SCHEMA-05 | Archive reader rejects traversal, links, duplicate/missing allowlist entries, cap/timeout violations; never executes source | unit/security | `npx vitest run test/server/upstream-archive.test.ts -x` | ❌ Wave 0 |
| SCHEMA-05 | AST parser accepts literal registry fixture and rejects calls/spreads/computed/identifier expressions | unit/security | `npx vitest run test/server/capability-registry-parser.test.ts -x` | ❌ Wave 0 |
| SCHEMA-05 | Reconciliation preserves curated fields, flags prose drift, retains removed keys as deprecated, and ignores order/format noise | unit | `npx vitest run test/schema-data/reconcile.test.ts -x` | ❌ Wave 0 |
| SCHEMA-05 | Proposal compile failure/activation atomicity/corrupt override fallback/reset retain a usable bundled manager | integration | `npx vitest run test/server/schema-route.test.ts test/server/active-schema-manager.test.ts -x` | Partly existing |
| SCHEMA-05 | Workspace shows source/version/date, review groups, no-op state, and explicit activate/reset | component | `npx vitest run test/web/schema-workspace.test.tsx -x` | ❌ Wave 0 |
| SCHEMA-05 | Activation updates rendering and server validation together | API + component integration | `npx vitest run test/server/schema-route.test.ts test/web/schema-workspace.test.tsx -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** focused Vitest file(s) plus `npm run typecheck` for contract changes.
- **Per wave merge:** `npm run test:ordinary`.
- **Phase gate:** `npm test && npm run typecheck && npm run build && npm pack --dry-run` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/server/schema-refresh.test.ts` — injected GitHub responses and deterministic lifecycle failures.
- [ ] `test/server/upstream-archive.test.ts` — adversarial archive fixtures and caps.
- [ ] `test/server/capability-registry-parser.test.ts` — literal acceptance and prohibited-syntax rejection.
- [ ] `test/schema-data/reconcile.test.ts` — curation/deprecation/semantic-diff fixtures.
- [ ] `test/server/active-schema-manager.test.ts` — persistence, compilation, version precedence, fallback/quarantine/reset.
- [ ] `test/web/schema-workspace.test.tsx` — staged UI, accessibility, status control, query invalidation behavior.
- [ ] Frozen fixtures under `test/fixtures/schema-refresh/` — valid pinned release content plus malformed/adversarial source/archive cases; ordinary tests must not call live GitHub.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture, Design and Threat Modeling | yes | Fixed upstream/release policy, explicit allowlist, untrusted-data boundary, fail-closed state machine. [VERIFIED: 06-CONTEXT.md] |
| V2 Authentication | yes | Existing per-launch token remains required for every schema API read/mutation. [VERIFIED: packages/server/src/app.ts] |
| V3 Session Management | yes | Per-launch token remains scoped to current local-helper launch; do not persist it with proposals/overrides. [VERIFIED: .claude/CLAUDE.md] |
| V4 Access Control | yes | Browser cannot supply repo/ref/path; backend owns fixed GitHub endpoints and app-data destination. [VERIFIED: 06-CONTEXT.md] |
| V5 Input Validation | yes | Validate release JSON, archive entries, JSON manifests, literal AST subset, normalized descriptor, persistence envelope, and Ajv compilation. [VERIFIED: 06-CONTEXT.md] |
| V6 Cryptography | yes | Use Node `crypto.createHash('sha256')` for provenance integrity recording; do not implement hashing. [CITED: https://nodejs.org/api/crypto.html] |
| V8 Data Protection | yes | Redact client errors; never log remote content, local storage paths, or config secrets. [VERIFIED: packages/server/src/app.ts; .claude/CLAUDE.md] |
| V12 Files and Resources | yes | No archive extraction; hard caps; reject paths/links/special entries; atomic app-data persistence. [CITED: https://github.com/isaacs/node-tar] |
| V13 API and Web Service | yes | Keep routes in guarded `/api` Fastify scope with frozen success/error envelopes. [VERIFIED: packages/server/src/app.ts; packages/server/src/api-types.ts] |

### Known Threat Patterns for local schema refresh

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Remote CommonJS top-level execution | Elevation of Privilege | Never load the archive as a module; literal-only AST parser rejects executable constructs. |
| Mutable ref/release confusion | Tampering | Resolve stable tag to immutable commit, fetch by commit, record SHA-256 and identity cross-checks. |
| Archive traversal/link/special file | Tampering / Elevation of Privilege | Stream-inspect, exact allowlist, no extraction, reject all links and unsafe paths. |
| Zip/tar bomb or slow body | Denial of Service | Network/decompression/entry/per-file/time/node caps; abort and discard on first breach. |
| Poisoned override persistence | Tampering / Denial of Service | Compile before proposal and activation; atomic single-envelope write; startup compile/fallback/quarantine. |
| Local webpage triggers refresh/activation | Elevation of Privilege | Existing token, Host, Origin, CORS checks; no unauthenticated `/api` route. |
| Server internals/path leakage | Information Disclosure | Generic UI errors and server-side warning sink only; no raw exception or local path response. |

## Sources

### Primary (HIGH confidence)
- [Local codebase: build-schema.ts](packages/schema-data/scripts/build-schema.ts) — current four-source reconciliation, trusted-local registry exception, curated-overlay precedence, specialized metadata behavior.
- [Local codebase: schema manager seam](packages/server/src/schema.ts) — inlined bundle and current module-cached validator.
- [Local codebase: API composition](packages/server/src/app.ts) — guarded `/api` scope and path-free error contract.
- [GitHub latest stable release API result](https://api.github.com/repos/open-gsd/gsd-core/releases/latest) — observed `v1.7.0`, non-prerelease, release date, and archive endpoint.
- [GitHub pinned stable tag](https://api.github.com/repos/open-gsd/gsd-core/git/ref/tags/v1.7.0) — observed immutable commit `b1c9381b7abbf443f16c197118236b45cdd0486a`.

### Secondary (MEDIUM confidence)
- [GitHub REST Releases documentation](https://docs.github.com/en/rest/releases/releases) — latest release endpoint and recommended media type.
- [Node.js globals documentation](https://nodejs.org/api/globals.html) — global fetch/AbortSignal platform support.
- [Node.js stream documentation](https://nodejs.org/api/stream.html) — `Readable.fromWeb` bridge for web streams.
- [TypeScript repository/compiler API examples](https://github.com/microsoft/TypeScript) — `createSourceFile` and AST guard traversal pattern.
- [node-tar security/readme](https://github.com/isaacs/node-tar) — archive link/path safety constraints and untrusted-input guidance.
- [open-gsd VERSIONING](https://github.com/open-gsd/gsd-core/blob/next/VERSIONING.md) — `latest` stable versus opt-in `next` prerelease policy.

### Tertiary (LOW confidence)
- None beyond the explicitly listed assumptions.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — existing project seams and Node/TypeScript/GitHub documentation are verified; `tar` remains gated by a SUS legitimacy verdict.
- Architecture: HIGH — directly grounded in locked context and current server/client source seams.
- Pitfalls: MEDIUM — execution/persistence pitfalls are codebase-grounded; archive guidance is official package documentation plus current advisory evidence.

**Research date:** 2026-07-20
**Valid until:** 2026-07-27 for release layout/API observations; re-check the exact upstream allowlist and `tar` advisory status at implementation time.
