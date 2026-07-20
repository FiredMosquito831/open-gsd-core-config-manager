# Phase 6: Live Schema Reconcile Against gsd-core - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 adds an app-wide, on-demand schema-maintenance workflow that checks the latest stable open-gsd/gsd-core release, safely parses an allowlisted set of upstream sources as inert data, builds and validates a proposed canonical schema, shows semantic added/changed/deprecated differences, and activates the accepted schema without losing curated beginner documentation.

This phase does not add scheduled/background refresh, prerelease channels, arbitrary release selection, per-key merge selection, schema-version history, or execution of remote repository code. It delivers SCHEMA-05 only.

</domain>

<decisions>
## Implementation Decisions

### Refresh source and trust boundary
- **D-01:** A normal refresh targets the **latest stable published gsd-core release** only. Do not follow the repository default branch, the prerelease/`next` channel, the locally installed version, or an arbitrary user-selected release.
- **D-02:** Resolve the latest stable release to immutable identity metadata and fetch its pinned tagged archive. Record at least the upstream release version and immutable commit/archive identity so every proposal and active schema is traceable.
- **D-03:** Apply strict network and archive limits and inspect only an explicit allowlist of expected schema/documentation files. Remote JavaScript/CommonJS/TypeScript is never imported, required, evaluated, or executed; any needed information must be extracted by a constrained data parser.
- **D-04:** Refresh is fail-closed. If any required source is absent, malformed, exceeds limits, identifies a conflicting release, or fails consistency/validation checks, produce no activatable proposal and leave the active schema unchanged. Errors must be actionable but must not expose local paths or raw internals.

### Change classification and review
- **D-05:** Compute normalized semantic differences, ignoring formatting and key-order noise. First-class review changes include key presence, type, allowed values/options, defaults, dynamic shape/pattern metadata, deprecation state, and relevant upstream documentation changes.
- **D-06:** A key absent from the new stable release is retained in the proposed schema as **deprecated**, with source-version evidence, rather than immediately removed. This keeps older project configs recognizable and documented instead of turning those fields into unexplained unknown keys.
- **D-07:** Curated `x-description`, category, option explanations, and source-confirmed specialized-editor metadata remain authoritative and are never blindly overwritten. When corresponding upstream prose changes, preserve the active curated text and visibly flag documentation drift for later editorial attention.
- **D-08:** Review presents a grouped summary of added, changed, and deprecated keys plus expandable per-key evidence. The user accepts and activates the entire validated proposal or cancels it; there are no per-category or per-key hybrid merges.

### Activation, persistence, and recovery
- **D-09:** Fetch/reconcile creates an inert proposal only. A separate explicit **Activate** action switches both schema rendering and authoritative server-side validation to the same already-validated proposal atomically.
- **D-10:** An accepted refreshed schema persists in application data across helper launches. It never modifies a tracked project, the installed gsd-core package, or the npm package's bundled artifact.
- **D-11:** The bundled schema remains an immutable recovery baseline. On startup, compare recorded upstream source versions and use whichever valid schema—bundled or persisted refresh—targets the newer stable gsd-core version; an older persisted refresh must not shadow a newer package bundle.
- **D-12:** Provide an explicit **Reset to bundled schema** control that atomically removes/deactivates the persisted override and returns both renderer and validator to the shipped baseline. Multi-version schema history is out of scope.
- **D-13:** Validate, normalize, and successfully compile a proposal with the project validator before it can be activated or persisted. Persist schema plus metadata atomically so interrupted writes cannot produce a half-updated active state.
- **D-14:** If a persisted override is corrupt, incompatible, or fails compilation at startup, safely fall back to the bundled schema, quarantine or ignore the invalid override, and show a persistent actionable warning. Do not block startup or fail silently.

### Workspace and freshness experience
- **D-15:** Schema maintenance is an **app-wide dedicated workspace**, not a selected config's schema chapter and not a modal. Enter it through a persistent utility/status affordance; retain the tracked-config sidebar for orientation but hide config chapter navigation while the workspace is active.
- **D-16:** During ordinary editing, show a compact persistent indicator with active source (`Bundled` or `Refreshed`), gsd-core source version, and accepted/refreshed date. Activating the indicator opens the schema workspace.
- **D-17:** The workspace follows a staged flow: check/fetch latest stable → validate and reconcile → show grouped summary and expandable evidence → explicit Activate or Cancel. Fetching alone never changes the active schema.
- **D-18:** If latest stable produces no semantic differences, show a clear up-to-date confirmation with the checked gsd-core version and check time, retain the current schema without a no-op activation, and update last-checked status separately from last-activated/refreshed status.

### Claude's Discretion
- Exact workspace layout, responsive breakpoints, icons, progress treatment, normalized diff presentation, filters, evidence expansion behavior, status wording, timestamp formatting, and warning copy are open to design/research, provided the staged and fail-closed interaction model above is preserved.
- Exact endpoint names, app-data filenames, proposal lifetime/expiry, archive limits, retry policy, and parser libraries are open to research and planning. They must preserve the existing secured `/api` boundary, frozen response envelopes, package portability, atomic activation, and remote-code non-execution contract.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and inherited product decisions
- `.planning/ROADMAP.md` — Phase 6 goal, SCHEMA-05 mapping, four success criteria, and Phase 6 boundary.
- `.planning/REQUIREMENTS.md` — exact SCHEMA-05 wording and v2 deferral of scheduled/automatic refresh.
- `.planning/PROJECT.md` — hybrid bundled-plus-live schema strategy, offline reliability, exhaustive coverage, local-only architecture, and data-safety constraints.
- `.planning/phases/01-schema-foundation-data-layer-safety/01-CONTEXT.md` — multi-source reconciliation authority, schema descriptor format, runtime-state exclusion, unknown-key preservation, and the original Phase 6 handoff.
- `.planning/phases/02-local-loopback-server-cli-security-hardening/02-CONTEXT.md` — loopback trust model, app-data persistence conventions, packaging constraints, and guarded API decisions.
- `.planning/phases/02-local-loopback-server-cli-security-hardening/02-API-CONTRACT.md` — frozen REST envelopes, token/Origin/Host rules, and additive API extension requirements.
- `.planning/phases/03-generic-schema-driven-ui-shell/03-CONTEXT.md` — documentation-first workspace, generic schema renderer, exhaustive chapter/key behavior, and app shell patterns.
- `.planning/phases/04-pool-editors-model-profile-specialization/04-CONTEXT.md` — source-confirmed specialized metadata and focused-workspace behavior that refresh must preserve.

### Current schema construction and validation
- `packages/schema-data/scripts/build-schema.ts` — existing four-source reconciliation, curated overlay precedence, runtime-state exclusion, fixture-observed keys, dynamic-shape derivation, and specialized metadata preservation. It currently executes a trusted local capability registry and therefore cannot be reused unchanged against remote content.
- `packages/schema-data/bundled-schema.json` — immutable shipped baseline and current flattened schema descriptor artifact.
- `packages/schema-data/curated-docs.json` — hand-authored descriptions, categories, and option explanations that must remain authoritative through refresh.
- `packages/schema-data/specialized-catalog.json` — source-confirmed specialized editor evidence that refreshed output must not erase or weaken.
- `packages/config-io/src/types.ts` — `SchemaEntry` and related frozen data contracts; research must determine the smallest additive metadata needed for deprecation and source identity.
- `packages/config-io/src/schema-convert.ts` — flat descriptor to Ajv schema conversion that every proposal must survive before activation.
- `packages/config-io/src/validate.ts` — authoritative validation construction and error behavior.
- `test/schema-data/completeness.test.ts` — current executable schema completeness and documentation gates to extend for refreshed proposals.

### Server and package integration
- `packages/server/src/schema.ts` — current compile-time-inlined immutable schema and module-cached validator; primary seam that must become one atomic active-schema provider without breaking bundled-package resolution.
- `packages/server/src/routes/schema.ts` — existing guarded `GET /api/schema` route and natural additive home for status/proposal/activate/reset operations.
- `packages/server/src/app.ts` — guarded `/api` plugin scope and dependency-injection seam for testable app-data/network behavior.
- `packages/server/src/api-types.ts` — frozen response-envelope types that Phase 6 extends additively.
- `packages/server/src/static/serve.ts` — SPA/package boundary that must continue working from an extracted npm tarball with no runtime source-tree dependency.
- `test/server/schema-route.test.ts` — current schema-route behavior and test seam for active schema status and refresh lifecycle.

### Client integration
- `web/src/api/schema.ts` — existing token-aware schema fetch wrapper to extend with status, proposal, activation, and reset calls.
- `web/src/components/AppShell.tsx` — existing `editor`/`history` dedicated-workspace pattern to generalize for app-wide schema maintenance.
- `web/src/components/ConfigEditor.tsx` — top-level query and workspace orchestration where schema status, cache invalidation, and active-schema changes integrate.
- `web/src/state/uiStore.ts` — workspace mode and UI-only state integration point.
- `web/src/schema/indexSchema.ts` — client schema indexing that must rebuild from the newly active schema after activation/reset.
- `web/src/schema/specializedMetadata.ts` — specialized descriptor consumption that refreshed schema must preserve.

### External upstream authority
- `https://github.com/open-gsd/gsd-core` — official upstream repository; refresh targets its latest stable published release, not the mutable default branch.
- `https://github.com/open-gsd/gsd-core/blob/next/VERSIONING.md` — official stable `latest` versus prerelease `next` release-channel semantics. Research must verify equivalent content at the pinned stable release used for implementation.
- `https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md` — official configuration reference and one of the documentation-evidence sources; parse from the pinned stable archive rather than this mutable URL at runtime.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/schema-data/scripts/build-schema.ts`: already codifies key authority, dynamic patterns, defaults, curated overlay precedence, deterministic sorting, fixture-observed compatibility, and specialized metadata retention. Extract reusable pure reconciliation logic rather than maintaining a second semantic implementation.
- `packages/schema-data/curated-docs.json` and `packages/schema-data/specialized-catalog.json`: durable local curation overlays that must be applied after upstream structural extraction.
- `packages/config-io/src/schema-convert.ts` and `packages/config-io/src/validate.ts`: existing compilation/validation gate for proving a proposal is usable before activation.
- `packages/server/src/routes/schema.ts` and `web/src/api/schema.ts`: existing secured schema transport boundary and thin client wrapper pattern.
- `web/src/components/AppShell.tsx`, `web/src/state/uiStore.ts`, and the History workspace: established dedicated-workspace behavior that can be generalized for global schema maintenance.

### Established Patterns
- The browser never performs privileged filesystem or external-source activation itself; all refresh network, parsing, persistence, validation, and state switching belong in the secured local helper.
- Every `/api` request uses the per-launch token and existing Host/Origin defenses. New schema reads and mutations remain inside this scope and use frozen success/error envelopes.
- The npm package currently inlines `bundled-schema.json` so extracted-tarball launches never depend on source-relative files. The bundled fallback must retain this property even after runtime overrides are introduced.
- Server validation is authoritative, while the client uses the same active descriptors for rendering and live feedback. Activation must invalidate/reload client schema and affected config queries together so they cannot drift.
- Unknown keys remain visible and preserved. Deprecation is a known-schema lifecycle state, not permission to strip a field from project data.
- Existing app-data snapshot/registry code provides conventions for cross-platform application storage, deterministic state, atomic file behavior, and test-root injection, though schema persistence is a separate store.

### Integration Points
- Refactor `packages/server/src/schema.ts` behind an injected active-schema manager that owns bundled metadata, persisted override loading, version precedence, compiled validator, atomic switching, fallback warnings, and reset.
- Extract the existing build script's source-independent reconciliation into pure code shared by maintainer builds and live refresh. Replace remote capability-registry execution with a constrained parser or equivalent inert evidence extraction.
- Add guarded proposal/status/activate/reset routes without exposing arbitrary URLs, refs, archive paths, or filesystem paths to the browser. The server fixes the repository and latest-stable policy.
- Add a dedicated client schema workspace and persistent status control. Activation/reset must invalidate the schema query, rebuild indices and live validation, and reload current config data under the new authoritative schema.
- Add deterministic fixtures for upstream archives and malformed/adversarial cases so normal tests require no live network. Reserve a clearly separated integration check for real latest-stable compatibility.

</code_context>

<specifics>
## Specific Ideas

- The active-schema indicator should communicate both **where the schema came from** and **which gsd-core version it represents**, not merely a vague date.
- The proposal review should make local curation behavior explicit: structural upstream changes are incorporated, curated beginner prose remains active, and upstream prose drift is flagged rather than silently discarded or silently overwriting curation.
- Refresh should feel like a deliberate maintenance operation: fetching prepares evidence; only a separate activation changes how the entire app renders and validates configs.
- A removed upstream key remains understandable for users with older configs by appearing as deprecated with provenance, rather than abruptly becoming an unrecognized field.

</specifics>

<deferred>
## Deferred Ideas

- Scheduled or automatic background schema refresh and changelog prompts (`AUTO-01`, v2).
- Prerelease/`next` channel support, installed-version targeting, arbitrary stable-release selection, and rollback to multiple historical refreshed schemas.
- Per-key or per-change-group merge selection and in-app editing of curated documentation.

These are separate capabilities and are not part of SCHEMA-05.

</deferred>

---

*Phase: 6-Live Schema Reconcile Against gsd-core*
*Context gathered: 2026-07-20*
