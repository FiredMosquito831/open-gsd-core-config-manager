# Domain Pitfalls

**Domain:** Local (loopback) npx-launched config manager for a large, deeply-nested, actively-evolving JSON config schema (gsd-core)
**Researched:** 2026-07-11
**Confidence:** MEDIUM-HIGH (grounded in gsd-core's actual `docs/CONFIGURATION.md` schema plus cross-checked web sources on atomic writes, DNS rebinding, JSON Schema evolution, and rjsf form bugs)

## Critical Pitfalls

### Pitfall 1: Naive read-modify-write silently drops unknown/future keys

**What goes wrong:**
The tool parses `config.json` into a JS object, the UI edits it through schema-driven form state, and on save the tool re-serializes *the form state* rather than the original parsed document. Any key present in the file that the bundled schema doesn't recognize — a field gsd-core added after the schema was last refreshed, a user's hand-added local override, a legacy/deprecated key kept for back-compat (e.g. gsd-core's top-level `search_gitignored` alias for `planning.search_gitignored`) — gets silently dropped from the written file. This directly violates the "omit nothing" requirement.

**Why it happens:**
It's the natural implementation path: schema defines the form model, form model becomes the write payload. Nobody explicitly designs for "keys the schema has never heard of." Confirmed as a real pattern in gsd-core's own docs — `.planning/config.json` has accumulated many versioned/legacy fields (`granularity` renamed from `depth` with auto-migration, `workflow.*` toggles added across v1.28–v1.43, reserved-but-unimplemented flags like `code_quality.fallow.mcp`).

**How to avoid:**
Load and retain the full original parsed JSON object as the source of truth. All edits mutate/patch that object at the specific key path being changed (JSON Pointer / lodash-set style), never a schema-derived reconstruction. On save, write the full object (original keys + edits), not a schema-shaped rebuild. The bundled/refreshed schema is used only to *drive the UI* and *validate*, never to *define the write shape*. A dedicated "Unknown Fields" section in the UI surfaces any key not in the schema (read-only or raw-JSON-editable) rather than hiding it.

**Warning signs:**
Diff view (already planned) shows keys disappearing between versions with no corresponding user edit. Golden-file round-trip test (parse → no-op save → parse) shows key count decreasing.

**Phase to address:**
Core I/O/data-layer phase, before any UI work — this is a foundational architecture decision, not a bolt-on fix. Add a round-trip-identity test (`load(config) === load(save(load(config)))` for unmodified data) as an early automated gate.

---

### Pitfall 2: Non-atomic writes leave a corrupted/truncated config.json on crash or Windows file lock

**What goes wrong:**
A plain `fs.writeFile(path, json)` that gets interrupted (process killed, crash, power loss, or on Windows an antivirus/indexer lock mid-write) can leave the target file half-written, truncated, or empty. Since `config.json` is read on every gsd-core command, a corrupted file breaks the user's entire GSD workflow, not just this tool.

**Why it happens:**
Direct in-place writes are the obvious first implementation and work fine in every manual test, because the crash window is small. The failure only shows up under real-world conditions: OS crash, disk full, or (on Windows specifically) a virus scanner grabbing a file handle in the ~50ms after a fresh write lands on disk.

**How to avoid:**
Always use the write-temp-then-rename pattern: write new content to a sibling temp file **in the same directory** (same filesystem — a cross-device temp dir makes the rename a non-atomic copy+delete and can fail with EXDEV), then `fs.rename()` the temp file over the target. POSIX/NTFS rename is atomic — readers see the old file or the new file, never a partial one. For extra durability, `fsync` the temp file before rename. On Windows, wrap the rename step in a retry-with-backoff (3-5 attempts) on `EPERM`/`EBUSY`/`EACCES` — `graceful-fs`'s built-in Windows retry only fires when the destination does *not* already exist, which is the opposite of the common "overwrite existing config.json" case, so it does not help here and must be handled explicitly.

**Warning signs:**
Any GitHub issue/support report of "my config.json is empty/truncated after using the tool," especially on Windows. Manual test: kill the process (`kill -9` / Task Manager) mid-save repeatedly and confirm the file is always either fully old or fully new.

**Phase to address:**
Core I/O/data-layer phase (the "atomic write" requirement is already explicit in PROJECT.md — implement temp+rename+Windows-retry as the actual mechanism, not just "atomic write" as an unspecified label).

---

### Pitfall 3: Loopback binding alone does not stop other websites from reaching the local server (DNS rebinding / CSRF)

**What goes wrong:**
Binding to `127.0.0.1`/`localhost` feels safe ("no server needed, it's local-only"), but any webpage the user has open in another browser tab can still send requests to the loopback server via DNS rebinding (a domain that first resolves to an attacker's server, then re-resolves to `127.0.0.1` after passing a same-origin check) or plain cross-origin fetch if CORS is left permissive. Since this tool performs **file-system writes to arbitrary project config files**, a successful attack means a malicious website can read or rewrite the user's GSD configs (and, depending on the file-picker/scan feature, potentially probe the filesystem) just by the user visiting a page while the tool happens to be running.

**Why it happens:**
"It's just localhost" is treated as an implicit security boundary, but it isn't — Vite's dev server, webpack-dev-server, and Parcel's dev server all shipped this exact vulnerability class and were patched only after disclosure (Vite: GHSA-vg6x-rcgg-rjx6, Jan 2025). Developers copy the "start an Express/http server on 127.0.0.1" pattern without adding the corresponding request-origin checks.

**How to avoid:**
Validate the `Host` header on every incoming request against an explicit allowlist (`localhost`/`127.0.0.1`/`[::1]` + the exact bound port); reject anything else with 403 before any routing logic runs. A browser cannot forge the `Host` header, so this alone defeats DNS rebinding. Additionally: never send `Access-Control-Allow-Origin: *`; if CORS is needed at all, echo back only the exact expected origin. Validate the `Origin` header on WebSocket upgrade requests too, if any live-reload/watch channel is used. Consider a per-launch random token embedded in the served HTML and required on all mutating API calls (defense in depth beyond Host validation) since this tool performs filesystem writes, not just reads.

**Warning signs:**
No Host/Origin validation anywhere in the request-handling code; `cors()` middleware used with default/`*` settings; any endpoint reachable via plain `fetch()` from a different origin during manual testing (open two browser tabs, one on a random page, try to `fetch('http://127.0.0.1:PORT/api/...')` from its devtools console — it should fail).

**Phase to address:**
Local server/loopback-helper phase, at initial implementation — this is not an optional hardening pass, it's core to the "no server needed" trust model the product is built on. Verify explicitly during that phase's UAT with the manual cross-tab fetch test above.

---

### Pitfall 4: Schema-driven forms silently mis-handle deep nesting, polymorphic (oneOf/union) fields, and default reconciliation

**What goes wrong:**
gsd-core's real config has fields that are unions of `string | object` (e.g. `model_profile_overrides.<runtime>.<tier>` accepts either a bare model-ID string or `{ model, reasoning_effort }`), arrays-of-objects used as named pools (`review.reviewer_instances`, `ship.pr_body_sections`), and multi-level precedence chains (`model_overrides` > `dynamic_routing.tier_models` > `models.<phase_type>` > `model_profile` > runtime default) where several config keys jointly determine a single effective value. Generic JSON-Schema-form implementations (react-jsonschema-form and its peers) have long-standing, still-open bugs in exactly this territory: defaults not reapplied when switching a polymorphic branch, defaults 3+ levels deep failing to populate, default enum values inside `oneOf` dropped from submitted form data entirely, and the "wrong" polymorphic branch getting silently auto-selected because auto-defaulting picks whichever branch currently happens to validate.

**Why it happens:**
Off-the-shelf schema-form libraries are built for flat-ish CRUD forms; gsd-core's config is a deeply composed, precedence-layered, versioned config surface, closer to a compiler's configuration than a typical settings page. Treating `oneOf`/union types as "just another field type" the generic renderer can handle out of the box is where these libraries break down.

**How to avoid:**
Do not adopt a generic JSON-Schema-to-form library wholesale for the polymorphic/pool sections; hand-build dedicated editor components for the known problem shapes (string-or-object toggle for `model_profile_overrides`, named-map-of-objects editor for `review.reviewer_instances`, ordered list-of-sections editor for `ship.pr_body_sections` with its own field-level validation like "at least one of source/template/fallback required"). For fields with multi-layer precedence (model resolution has 5 layers), the UI must show the **effective resolved value** alongside which layer set it, not just raw fields in isolation — otherwise users will edit `model_profile` and be confused why nothing changed because a `model_overrides` entry wins. Never silently populate/repopulate defaults into fields the user hasn't touched; only fill defaults on first render of a brand-new file, and preserve whatever is on disk otherwise (ties back to Pitfall 1).

**Warning signs:**
QA finds that switching a dropdown that changes a `oneOf` branch loses previously-entered sibling values; saved file has extra keys that were never intentionally set (defaults leaking into disk state); users report "I changed X but the effective behavior didn't change" (precedence-layer confusion).

**Phase to address:**
Form/editor UI phase for the "array pools" and "model profiles" requirements specifically — treat these as bespoke components from the start rather than generic-schema-form output, and budget explicit design time for them rather than assuming the generic form renderer will "just work."

---

### Pitfall 5: Bundled canonical schema drifts from the real, evolving gsd-core schema, and validation becomes either too strict (rejects valid new configs) or too permissive (accepts garbage)

**What goes wrong:**
The bundled schema is a snapshot; gsd-core ships new keys, renames keys (`depth` → `granularity`, auto-migrated), adds enum values (`model_profile: adaptive` added later), and reserves-but-doesn't-implement keys (`code_quality.fallow.mcp`) on its own release cadence. If the bundled/validation schema encodes `additionalProperties: false` anywhere, a config written by a newer gsd-core version with a field the bundled schema doesn't know about will fail validation and block saving entirely — actively causing the "must not omit any key" failure the product exists to prevent. Conversely, gsd-core's own docs note that *direct file edits* are validated more loosely than its `config-set` CLI (typos in some fields are silently ignored and fall through to defaults rather than erroring) — mirroring that behavior inconsistently would confuse users about whether their edit "took."

**Why it happens:**
Schema-as-source-of-truth is tempting for validation because it's simple and catches real mistakes, but any closed (`additionalProperties: false`) schema node becomes a compatibility trap the instant the real config schema gains a new field faster than this tool's release cycle can track it.

**How to avoid:**
Never set `additionalProperties: false` in the validation schema at the object level actually used for validate-before-write; use it (or `unevaluatedProperties: false` for composed subschemas) only for advisory linting/warnings displayed in the UI, never as a hard save-blocker. Treat the schema as open on read (unknown keys pass through untouched, per Pitfall 1) and only enforce type/shape constraints on keys the schema *does* recognize. Ship the "refresh from gsd-core repo" mechanism (already planned) with a visible "schema last refreshed: vX.Y / date" indicator and a manual refresh action, and design the refresh diff to flag new/removed/renamed keys for review rather than blindly overwriting the bundled schema (a silent full overwrite risks losing curated beginner-friendly descriptions for fields the auto-fetch can't caption as well).

**Warning signs:**
User reports "the tool won't let me save my config even though it works fine with gsd-core directly" (over-strict validation); tool silently strips or mis-displays a field gsd-core added in a version released after the bundled schema snapshot (schema staleness); refresh-from-repo overwrites hand-curated descriptions with blank/generic ones.

**Phase to address:**
Schema-strategy phase (bundled schema + repo-refresh reconciliation) — the "never additionalProperties:false at the enforcement layer" rule should be a written architectural constraint from the first schema-loading implementation, not discovered after a user complaint.

---

### Pitfall 6: Model-profile edits appear to save successfully but don't actually change agent behavior

**What goes wrong:**
gsd-core's real model-resolution system has five precedence layers (`model_overrides[agent]` > `dynamic_routing.tier_models` > `models[phase_type]` > `model_profile` > runtime default), and on the Codex/OpenCode runtimes the resolved model is **baked into each agent's static frontmatter at install time** — editing `model_overrides` in `config.json` has **no effect until `gsd install` is re-run** (gsd-core's own documented gotcha, tracked as issue #2256). A config manager that lets users edit `model_overrides` and reports "saved" without surfacing this will produce a confusing, silently-broken experience: the user changed the setting, the file is correct, but nothing changed at runtime. Separately, gsd-core accepts either a tier alias (`opus`/`sonnet`/`haiku`/`inherit`) or a fully-qualified model ID string (`"openai/o3"`) in the same field with no catalog validation of the ID's correctness — a typo'd model ID is accepted and only surfaces as a runtime API error much later, matching a widely-seen failure pattern in comparable model-routing tools (silent fallback to picker/default, no actionable error at config-save time).

**Why it happens:**
The config file is necessarily decoupled from the install-time artifact generation step on some runtimes; a config editor operating purely on `config.json` has no visibility into that gap unless it's explicitly told about it. Free-text model-ID fields feel like a minor UX shortcut compared to validating against a live catalog.

**How to avoid:**
Surface a clear, runtime-aware notice when saving changes to `model_overrides`, `models.*`, `dynamic_routing.*`, or `model_profile_overrides` on Codex/OpenCode-style installs: "This change requires running `gsd install` to take effect." Validate model-ID strings where possible against the bundled model catalog (`sdk/shared/model-catalog.json` equivalent) or at minimum a `provider/model` shape check, and warn (don't block) on unrecognized IDs rather than silently accepting anything. When editing per-agent overrides, show the *effective* resolved tier for each of the ~33 shipped agents (not just the raw override map) so users can see the actual outcome of `model_profile` + `models.*` + `model_overrides` composition before saving.

**Warning signs:**
User edits a model override, saves, and reports "nothing changed" — this is the single most likely early support complaint for this feature given it's a documented gsd-core gotcha, not a hypothetical.

**Phase to address:**
Model-profile editor phase — build the "effective value + install-required notice" UX as a first-class part of the feature, not an afterthought, since the underlying gsd-core behavior is already known and documented.

---

### Pitfall 7: Some GSD settings don't live in config.json at all, and materializing every default into the file breaks forward-compatibility

**What goes wrong:**
Two related traps specific to gsd-core's real config surface: (1) `worktree.baseRef` and related worktree settings live in `.claude/settings.local.json`, not `.planning/config.json` — a tool that assumes "the config" is one file will simply never surface this setting despite it clearly being GSD configuration from the user's perspective. (2) Most `workflow.*` toggles follow an explicit "absent = enabled" convention — a key missing from the file defaults to `true`. If this tool always writes out the *full* resolved object (every key, with its current effective value, even ones the user never touched), it converts every previously-omitted "inherits future default" key into a permanently pinned value. When gsd-core later ships a new default for that toggle, users of this tool won't get it, while users who never touched the file directly will — a subtle, hard-to-diagnose divergence.

**Why it happens:**
"Show and let the user edit every field" is the natural UI design, but persisting the full materialized object on every save (rather than only the deltas the user actually changed) conflates "display value" with "write value."

**How to avoid:**
Track per-key dirty/touched state in the editor. On save, only write keys that (a) already existed in the original file, or (b) were explicitly changed by the user in this session — never write a key purely because the UI displayed its default value. For the `.claude/settings.local.json` split, explicitly research and enumerate every file gsd-core actually reads settings from (not just `.planning/config.json` and `defaults.json`) during the schema-curation work, and model the sidebar/editor around "a GSD project" (which may span multiple files) rather than "a config.json file."

**Warning signs:**
Diff view shows large numbers of keys added on first save of an untouched file (materialization); users on a version upgrade of gsd-core report new defaults "not taking effect" only for projects managed through this tool; worktree settings are simply absent from the entire UI with no path to reach them.

**Phase to address:**
Schema-strategy phase (identify all real config file locations) and core I/O phase (delta-only writes) — both foundational, address before the UI/forms phase is built on top of assumptions that would need retrofitting.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Reconstruct the write payload from schema/form state instead of patching the original parsed object | Simpler mental model, faster initial build | Silently drops unknown/future keys (Pitfall 1) — violates a core requirement | Never |
| Skip Host-header validation on the loopback server ("it's just localhost") | Saves a day of work | DNS-rebinding exposure to arbitrary websites while the tool runs (Pitfall 3) | Never — this is core to the trust model, not a nice-to-have |
| Use a generic JSON-Schema-form library unmodified for `oneOf`/pool fields | Fast MVP for simple scalar fields | Broken default handling and branch-selection bugs on exactly the complex fields this tool exists to make easy (Pitfall 4) | Acceptable only for the flat/scalar majority of fields; never for the polymorphic/pool minority |
| `additionalProperties: false` in the enforcement (save-blocking) schema | Catches obvious typos immediately | Blocks saving any config with a newer-gsd-core field the bundled schema hasn't caught up to (Pitfall 5) | Never at the enforcement layer; fine for advisory/lint-only checks |
| Write the fully materialized config object (every key, every default) on every save | Predictable, "what you see is what's on disk" simplicity | Freezes forward-compat "absent = default" fields, causing silent divergence from gsd-core's evolving defaults (Pitfall 7) | Acceptable only as an explicit opt-in "expand all defaults into file" action the user consciously triggers, never as default save behavior |
| Skip Windows-specific rename retry logic, ship the POSIX-only temp+rename pattern | Simpler code, works fine on the developer's Mac/Linux dev machine | Random EPERM save failures on Windows, the user's actual platform (Pitfall 2) | Never — the target user is explicitly on Windows 11 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| gsd-core repo (schema refresh) | Blindly overwrite the bundled schema with whatever the repo currently contains | Diff old vs. new schema on refresh, flag added/removed/renamed keys, preserve curated descriptions where the key is unchanged |
| gsd-core CLI (`gsd install`, `config-set`) | Assume editing `config.json` is equivalent to using `gsd config-set` | Mirror gsd-core's own documented gaps (install-required for some model settings, looser validation on direct file edits) rather than pretending the file is the whole story |
| Browser (served UI) | Trust that "served from 127.0.0.1" implies no cross-origin risk | Host-header allowlist + no wildcard CORS + origin-checked WebSocket upgrades (Pitfall 3) |
| OS file system (Windows) | Reuse a Linux-tested atomic-write helper unmodified | Add Windows-specific EPERM/EBUSY/EACCES retry-with-backoff around the rename step specifically |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Full-schema re-render on every keystroke in deeply nested forms | UI stutters when editing large `workflow.*`/`review.*` sections | Scope form state and re-render to the changed subtree only; virtualize long pools (`review.reviewer_instances`, `agent_skills` maps) | Noticeable once a project's config exceeds a few dozen touched keys, and near-certain with `agent_skills` maps across the 22+ consumer agent types |
| Recursive folder scan on "scan a chosen folder for config.json" without excluding `node_modules`/`.git` | Multi-minute hangs or crashes on large monorepos | Explicit directory exclusions (already noted as a requirement) plus a depth cap and cancel button | Any repo with `node_modules` present at scan time — i.e., almost immediately |
| Re-fetching/re-parsing the entire gsd-core repo schema on every app launch | Slow startup, unnecessary network dependency for an otherwise-offline tool | Cache the refreshed schema locally with a manual/periodic refresh action, not an on-every-launch fetch | As soon as more than a handful of tracked config files exist and the user launches the tool frequently |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No Host/Origin validation on the loopback HTTP server | Any website the user visits can read/write their GSD configs via DNS rebinding or plain CORS while the tool is running | Host-header allowlist on every request; reject non-loopback Origin; no wildcard CORS (Pitfall 3) |
| Displaying API-key/secret fields (`brave_search`, `firecrawl`, `exa_search`, etc.) in plaintext in the UI | Shoulder-surfing/screen-recording leaks of credentials that gsd-core itself takes care to mask in its own CLI output | Mask secret-shaped fields (8+ char strings in known key fields) the same way gsd-core's own CLI does (`****last4`), with an explicit reveal action |
| Treating "local only, no auth" as sufficient because there's no traditional network exposure | Ignores the loopback-specific threat model (DNS rebinding, malicious localhost-aware browser extensions) entirely | Apply the Host/Origin checks above regardless of "it's local"; consider a per-session token for mutating requests |
| Following symlinks/arbitrary paths uncritically when resolving `agent_skills` / `trusted_global_roots`-style path fields in the editor | Could let a malicious project config point the UI at sensitive files outside the project (mirrors gsd-core's own symlink-escape protection concern) | Reuse gsd-core's own path-safety posture: validate paths stay within expected roots, don't blindly `realpath`-resolve without a boundary check, when the tool itself reads referenced files (e.g. showing skill file previews) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Showing raw config keys (`workflow.plan_bounce_script`) without surfacing precedence/interaction with sibling keys (`workflow.plan_bounce` must be true for it to matter) | User sets a field that silently has no effect because a prerequisite toggle is off | Show inline "requires X to be enabled" hints and grey out/annotate dependent fields when their prerequisite is off |
| Flat list of ~150+ config keys with no guidance on what's safe to touch | Beginners (the target audience) are overwhelmed or make risky edits (e.g. `capabilities.strict_known_registries`, `security.*`) without understanding blast radius | Category tabs (already planned) plus a visible risk/impact indicator on sensitive fields (security, git branching, model routing) distinct from purely cosmetic ones |
| Reporting "saved" identically regardless of whether the change is live immediately or requires `gsd install` / a restart | User believes a change took effect when it silently didn't (Pitfall 6) | Differentiate "saved to disk" from "active" in the UI, with explicit guidance for the fields where they diverge |
| No indication of which values are defaults vs. explicit overrides | User can't tell if a shown value is what they set or just what gsd-core defaults to | Consistent visual marker (badge/color) for "using default" vs. "explicitly set", tied to the delta-tracking mechanism from Pitfall 7 |

## "Looks Done But Isn't" Checklist

- [ ] **Atomic write:** Often missing the Windows-specific rename retry — verify by killing the process mid-save on Windows repeatedly and confirming no corruption, not just testing on macOS/Linux.
- [ ] **"Omit nothing" coverage:** Often missing unknown-key passthrough — verify with a round-trip test using a config file containing a deliberately fabricated unknown top-level and nested key, confirming both survive an unrelated edit + save.
- [ ] **Loopback security:** Often missing Host-header validation entirely — verify by attempting a cross-origin `fetch()` from an unrelated site's devtools console while the tool is running.
- [ ] **Model profile editing:** Often missing the "requires `gsd install`" notice and effective-value display — verify by editing `model_overrides` on a Codex/OpenCode-style project and confirming the UI is honest about whether the change is live.
- [ ] **Schema refresh:** Often missing a real diff/review step — verify that refreshing the bundled schema from the live repo doesn't silently blow away curated descriptions for unchanged keys.
- [ ] **Array-as-pool editors:** Often missing validation matching the real schema constraints (e.g. `ship.pr_body_sections` requiring at least one of `source`/`template`/`fallback`) — verify against gsd-core's actual documented validation rules, not just generic "array of objects" UI.
- [ ] **Multi-file config surface:** Often missing settings that live outside `.planning/config.json` (e.g. `.claude/settings.local.json` worktree settings) — verify the sidebar/editor doesn't silently pretend these don't exist.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Corrupted config.json from a non-atomic write | LOW (if snapshot history exists) | Restore from the most recent pre-corruption snapshot; the planned version-history/revert feature is the primary recovery path — make sure it's resilient enough to recover even when the *live* file is corrupted, not just when it's valid-but-wrong |
| Unknown keys silently dropped in a past save | MEDIUM | Requires a prior snapshot (history) containing the keys, or the user's own git history of `.planning/`, to recover; this is exactly why Pitfall 1 must be prevented rather than merely made recoverable |
| DNS-rebinding exploitation after the fact | HIGH | No in-app recovery — this is a security incident requiring the user to review what was changed via version history/diff and manually assess/revert; underscores why Pitfall 3 is prevention-only, not recoverable |
| Materialized-defaults divergence (Pitfall 7) discovered after a gsd-core upgrade | MEDIUM | Requires diffing the user's file against a fresh `defaults.json` to identify which "explicit" values are actually just stale materialized defaults, then offering a "reset to inherit default" action per key |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1. Naive read-modify-write drops unknown keys | Core I/O / data-layer phase | Round-trip identity test with fabricated unknown keys; diff view shows zero unexplained key loss |
| 2. Non-atomic / Windows-unsafe writes | Core I/O / data-layer phase | Kill-mid-save stress test on Windows; confirm temp+rename+retry implementation, not just a label |
| 3. Loopback DNS rebinding / CSRF | Local server / loopback-helper phase | Manual cross-origin fetch test from an unrelated tab; automated test asserting non-allowlisted Host headers are rejected |
| 4. Schema-form deep-nesting/oneOf bugs | Form/editor UI phase (array pools + model profiles) | Manual QA of default-repopulation when switching polymorphic branches; confirm bespoke components used for known problem shapes, not generic renderer |
| 5. Schema drift / over-strict or over-permissive validation | Schema-strategy phase | Test that a config with a synthetic "future" field validates and saves without loss; confirm `additionalProperties:false` is absent from the enforcement schema |
| 6. Model-profile edits that silently don't take effect | Model-profile editor phase | UAT: edit `model_overrides`, confirm UI states install-required where applicable and shows effective resolved tier |
| 7. Multi-file config surface + default materialization | Schema-strategy phase + Core I/O phase | Audit of all real gsd-core settings file locations; delta-only write test confirming untouched defaults aren't persisted |

## Sources

- gsd-core official docs, `docs/CONFIGURATION.md` (open-gsd/gsd-core, `next` branch) — primary/authoritative source for all gsd-core-specific schema facts (precedence layers, `gsd install` requirement, absent=enabled convention, worktree.baseRef file location, legacy aliases, reserved/unimplemented keys). Fetched directly from GitHub.
- Node.js atomic-write pattern: Jsonic.io fs guide, ResumeLens Node.js fs.promises guide, TheLinuxCode Node.js file-system patterns article (cross-checked, MEDIUM confidence)
- Format-preserving JSON editing: comment-json, node-jsonc-parser (Microsoft/VS Code), doctor-json (privatenumber) npm packages
- File locking: moxystudio/node-proper-lockfile docs; Roo-Code's `safeWriteJson.ts` real-world usage pattern
- JSON Schema evolution/compatibility: Robert Yokota's "JSON Schema Compatibility and the Robustness Principle" (2025-10-07); learnjsonschema.com `unevaluatedProperties` reference; Jsonic.io JSON Schema migration guide
- DNS rebinding / loopback security: genkit-ai/genkit PR #5587 (Host-header validation fix); webpack/webpack-dev-server issue #887; GitHub Security Lab blog "DNS rebinding attacks explained" (2025-06-03); parcel-bundler/parcel PR #10138; blogs.jsmon.sh DNS rebinding writeup referencing the Vite dev-server CVE (GHSA-vg6x-rcgg-rjx6, patched Jan 2025)
- react-jsonschema-form issues: rjsf-team/react-jsonschema-form #4476, #4399, #2296, #4918, #3383 (oneOf/anyOf default and nesting bugs)
- Windows file-locking/EPERM: nodejs/node issue #29481; npm/write-file-atomic issue #227; npm/cli PR #9028 (Windows EPERM retry for bin-links); errornotes.dev EPERM rename troubleshooting guide
- Port allocation: sindresorhus/get-port docs; portrm.dev EADDRINUSE guide
- Model-routing footguns (cross-checked against comparable non-GSD projects, illustrating the general failure class): openclaw/openclaw issues #81297, #29564, #83107; hermes-agent issue #17446

---
*Pitfalls research for: GSD Config Manager (local npx config editor for gsd-core)*
*Researched: 2026-07-11*
