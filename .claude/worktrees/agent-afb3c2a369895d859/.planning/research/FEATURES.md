# Feature Research

**Domain:** Local config-manager / settings-editor GUI for the `gsd-core` (open-gsd) `.planning/config.json` schema
**Researched:** 2026-07-11
**Confidence:** MEDIUM-HIGH (generic config-editor UX patterns are well-established/HIGH; gsd-core schema details are sourced from `docs/CONFIGURATION.md`, `docs/COMMANDS.md`, and web summaries — MEDIUM, cross-checked against a real project's `config.json`, which is HIGH/primary)

---

## Part A — Feature Landscape (Config-Manager / Settings-Editor Tools)

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Schema-driven form (not raw textarea) | Every serious settings UI (VS Code Settings, `json-editor`, MetaConfigurator, JSONBuddy) renders typed controls per key, not a JSON blob | MEDIUM | Needs the bundled canonical schema as input; this is the foundation everything else builds on |
| Search/filter across all settings | Users don't know which of 20+ tabs holds a setting; VS Code's settings search is the reference UX | LOW | Simple string match over key + label + description is sufficient for v1 |
| Field-level inline documentation | Config editors that just show a bare key with no explanation force users back to docs — defeats the product's purpose | LOW-MEDIUM | Must cover per-key AND per-enum-option text (this project's differentiator is depth, not existence) |
| Enum values as dropdown/radio, not free text | Prevents invalid strings like `"granularity": "fien"`; standard in every schema-driven editor reviewed (json-editor, MetaConfigurator) | LOW | Straightforward once schema has `enum` lists |
| Default vs. overridden indicator | Users need to know "is this the shipped default or did someone change it" before editing blind | MEDIUM | Requires loading both `defaults.json` and `config.json` and diffing |
| Reset-to-default (per field) | Universal escape hatch in every settings UI (VS Code "Reset Setting") | LOW | Trivial once default value is known per key |
| Form validation with inline errors | Schema-driven editors (json-editor, MetaConfigurator) expose validation as `{path, property, message}` — same shape works here | MEDIUM | Validate types/enums/required client-side before allowing save |
| Array editing without raw JSON | `minItems`/`maxItems`/add-remove-reorder is the established pattern (json-editor docs) — this project calls it "pools" | MEDIUM-HIGH | GSD has ~6 distinct array/map shapes (see Part B) — this is a bigger lift than typical because the shapes vary (list of scalars vs. list of objects vs. agent-name-keyed maps) |
| Load existing file on open | Editing an existing config must show current real values, not schema defaults | LOW | Straightforward file read + merge |
| Sidebar / file switcher for multiple configs | Not universal in generic JSON editors, but required by this project's explicit requirement (multi-project usage) | MEDIUM | Persisted list of tracked paths, not a filesystem browser |
| Save persists cleanly (stable formatting) | Users will diff these files in git; churn from re-ordering keys or re-indenting erodes trust | LOW-MEDIUM | Preserve key order and existing indentation where possible |
| Create new config from defaults | "New project" flow needs a zero-friction starting point | LOW | Effectively a copy of the merged-defaults object |
| Clear save success/failure feedback | Table stakes for any tool that writes to disk | LOW | — |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Beginner-plain-language docs for every key **and every enum option's implications** | Most schema editors show the raw JSON Schema `description` (often terse/technical). This project's Core Value is explicitly "understand exactly what every setting and option means... without reading gsd-core source" — this is the product, not a nice-to-have | MEDIUM-HIGH | Requires hand-curated copy for ~150+ leaf keys and their enum values (see Part B inventory) — largest content-authoring effort in the project |
| Hybrid schema: bundled + live refresh/reconcile against `open-gsd/gsd-core` repo | gsd-core's own maintainers have hit schema-drift bugs (`VALID_CONFIG_KEYS` duplicated between `gsd-tools.cjs` and `sdk/src/config-schema.ts` diverging silently — see Part B notes). A tool that goes stale the moment gsd-core ships a new version breaks its own core promise | HIGH | Needs a reconciliation/diff step (new keys found in repo vs. bundled schema) and a safe merge story, not just re-download |
| Unknown/new key surfacing (never silently drop) | Forward-compatibility safety net; directly defends against the exact drift problem gsd-core itself has had | MEDIUM | Compare loaded file's keys against canonical schema; render "unrecognized keys" as a distinct raw-editable section instead of losing them on save |
| Multi-project sidebar with optional scoped folder scan | Generic editors are single-file; developers using GSD across many repos want one place to manage all of them | LOW-MEDIUM (manual add) / MEDIUM (folder scan) | Manual add is P1; folder scan (bounded, ignoring `node_modules`/`.git`) is P2 |
| Full version history with diff + one-click revert | Goes beyond "rely on your own git" (the generic-editor community's usual answer) — valuable specifically because many GSD projects may have `planning.commit_docs` variations or the config file may not always be committed at the moment of editing | MEDIUM-HIGH | Needs its own append-only snapshot store (JSON files or SQLite) + a diff renderer; must NOT be conflated with the user's own project git history |
| Effective-value / precedence visualization for model resolution | Model resolution precedence is genuinely confusing: `model_overrides` → `dynamic_routing.tier_models` (if enabled) → `models[phase_type]` → `model_profile` tier → runtime default. Visualizing "why is `gsd-executor` using Sonnet right now" is a real beginner pain point | HIGH | Requires implementing the actual precedence logic client-side (read-only simulation), not just displaying raw keys |
| Purpose-built Model Profile matrix editor (profiles × ~33 agents × tiers) | The `effort.agent_overrides` block alone in a real project file lists 30 agent names — editing that as raw JSON is exactly the kind of beginner footgun this product exists to prevent | HIGH | Needs a dedicated agent-picker + tier-picker grid UI, reusable for `model_overrides`, `effort.agent_overrides`, `fast_mode.agent_overrides` |
| Purpose-tuned pool editors per real GSD array/map shape | `ship.pr_body_sections` (array of structured objects with template variables), `agent_skills` (agent → skill-list map), `review.reviewer_instances` (named external CLI configs), `planning.sub_repos` (path list) each need a bespoke, guided form — not one generic "array of any" widget | HIGH | Biggest engineering surface area after the model-profile editor; see Part B for exact shapes |
| Atomic write + validate-before-write gate | Table stakes in spirit, but doing it *correctly* (temp file + rename, schema-validate before touching disk) is what actually prevents corruption — worth calling out as a differentiator because most "quick JSON editors" (text editors, `jq -i`) don't do this | MEDIUM | Standard pattern: write temp, fsync, rename over original |
| Explicit, bounded discovery (no background crawling) | Explicitly chosen over convenience; matters as a trust/safety differentiator for a tool with disk-write privileges | LOW | Already decided in PROJECT.md — implementation is just "don't auto-scan on launch" |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Run/orchestrate GSD workflows from the config tool (spawn `/gsd-plan-phase`, run agents, etc.) | "Since I'm already here editing config, let me just run the phase too" | Massive scope creep into a completely different product (an IDE/orchestrator); duplicates `gsd-manager`/CLI; breaks "local, no server, config-only" positioning | Deep-link out to the terminal/CLI docs; config tool only edits values, never executes GSD commands |
| Hosted sync / cloud backup / real-time multi-user collaboration | "I want my config synced across machines" | Directly contradicts the explicit "no server, local-only" constraint; introduces auth, hosting, and privacy surface for a tool that touches project secrets (API keys in `brave_search`, `firecrawl`, etc.) | Users already have git for their `.planning/` directory (see `planning.commit_docs`); tool stays local-file-only |
| Generic "edit any JSON/YAML file" mode | "Since you built a nice JSON editor, let me use it for other configs too" | Dilutes the curated, beginner-friendly explanation engine that IS the product; reopens all the raw-editing footguns the product exists to prevent; explicitly out of scope per PROJECT.md | Stay GSD-config-only; if users want a generic JSON editor, that's a different (already well-served) product category |
| Unbounded background filesystem crawling/watching on launch | "Just find all my GSD projects automatically" | Privacy/performance risk, surprising behavior, explicitly rejected in PROJECT.md Out of Scope | Manual add + optional user-triggered, scoped folder scan (already the decided design) |
| In-app AI/LLM "auto-configure this for me" assistant | Feels natural for an AI-tooling config product | Requires API keys/network calls, breaks "no server" positioning, and risks confidently-wrong advice on a schema that changes across gsd-core versions (see the `model_profile_overrides` vs. `model_overrides` ambiguity found during this research — even docs and the real file disagree) | Invest in high-quality static plain-language docs + sane presets instead of a live-advice feature |
| Config tool auto-updates gsd-core itself (npm package bump, agent/skill files) | "Might as well keep gsd-core current while I'm in here" | Out of scope (this manages configuration, not the framework installation); mixes two update lifecycles and two failure domains | Link to `npx gsd-core@latest` / `/gsd-update` docs; never touch anything outside `.planning/config.json` / `defaults.json` |
| Raw-JSON-only editing for the complex pools (`pr_body_sections`, `agent_overrides`, etc.) | "Power users just want to paste JSON" | Reintroduces exactly the corruption/confusion risk the guided-pool feature exists to prevent, and defeats the "beginner never needs to read source" Core Value | Guided pool editor as primary; offer a schema-validated raw-JSON "advanced" toggle per section as an escape hatch, still gated by validate-before-save |
| Silently dropping unknown/future keys on save ("clean up" the file) | Seems like good schema hygiene | Destroys forward compatibility and can silently delete a user's data the moment gsd-core ships a new config key ahead of this tool's schema update | Always preserve + surface unknown keys (explicit PROJECT.md requirement) |
| Deep git automation inside the tool (auto-commit config changes, create branches/PRs) | "You already have version history, just commit it" | GSD itself owns git workflow semantics (`git.branching_strategy`, phase/milestone branch templates) — a second tool executing git actions creates two conflicting sources of truth over the user's repo | Keep the tool's own version history in its own local snapshot store, separate from the user's project git history; never invoke git on the user's behalf |

---

## Feature Dependencies

```
Bundled curated canonical schema (keys + types + enums + plain-language docs)
    └──requires──> nothing (foundational; hand-authored + scraped from gsd-core docs)

Schema-driven category-tabbed form
    └──requires──> Bundled curated canonical schema

Array/map "pool" generic editor
    └──requires──> Schema-driven category-tabbed form (reuses its field renderers)

Purpose-built pool editors (pr_body_sections, agent_skills, reviewer_instances, agent_overrides)
    └──requires──> Array/map generic pool editor (specializes it per shape)

Model Profile matrix editor (profiles × agents × tiers)
    └──requires──> Bundled model-catalog data (agent list + tier assignments per profile)
    └──requires──> Purpose-built pool editors (agent_overrides UI reused for effort/fast_mode)

Effective-value / precedence display
    └──requires──> Discovery of BOTH config.json AND ~/.gsd/defaults.json (global user defaults)
    └──requires──> Bundled canonical schema (to know default values)

Unknown-key surfacing
    └──requires──> Bundled curated canonical schema (diff loaded keys against it)

Validate-before-save + atomic write
    └──requires──> Bundled curated canonical schema (validation source of truth)

Version history with diff + revert
    └──requires──> Validate-before-save + atomic write (snapshot is taken at each successful save)

Live schema refresh/reconcile against gsd-core repo
    └──requires──> Bundled curated canonical schema (diffs against it; never replaces it wholesale)
    └──enhances──> Unknown-key surfacing (refresh can resolve "unknown" keys into documented ones)

Multi-config sidebar (manual add)
    └──requires──> nothing (independent, can ship day one)

Folder-scan discovery
    └──enhances──> Multi-config sidebar (alternate population method, not required for it to work)

Create-new-config-from-defaults
    └──requires──> Discovery of ~/.gsd/defaults.json + Bundled curated canonical schema

Raw-JSON advanced escape hatch (per pool)
    └──conflicts with──> "Never expose corruption risk" goal if not also gated by validate-before-save
```

### Dependency Notes

- **Effective-value display requires discovering `~/.gsd/defaults.json`, not a project-level `defaults.json`.** Research found a discrepancy worth flagging loudly for requirements/roadmap: `docs/CONFIGURATION.md` and the merge-behavior docs state defaults live in a single **global** location, `~/.gsd/defaults.json` (populated via `/gsd-settings`, read by `/gsd-new-project`), and that **there is no project-level `.planning/defaults.json`**. The milestone context and PROJECT.md phrase discovery as "`.planning/config.json` + `defaults.json`" — the tool should discover the **global** `~/.gsd/defaults.json` alongside each project's `.planning/config.json`, not look for a second file inside `.planning/`. This should be confirmed/resolved explicitly during roadmap/requirements, not assumed silently.
- **Model Profile matrix editor and pool editors share a component** because their underlying data shape is identical: an agent-name key mapped to a value (tier, effort level, or boolean). Building one reusable "agent picker + value picker" grid serves `model_overrides`, `effort.agent_overrides`, and `fast_mode.agent_overrides` simultaneously — plan this as one investment, not three.
- **Live schema refresh enhances but does not replace** the bundled schema — the bundled copy is what makes the tool work offline and is where the beginner-friendly prose lives (a live-fetched raw schema from gsd-core has no such prose). Refresh's job is narrowly to detect *new/changed/removed keys*, not to regenerate documentation text automatically.
- **Version history conflicts with** any design that ties saves 1:1 to git commits — keep the snapshot store tool-owned and independent so history still works in an uncommitted or non-git-tracked config.

---

## Part B — Canonical gsd-core Config Schema Inventory (What Must Be Rendered)

Source: `docs/CONFIGURATION.md` and `docs/COMMANDS.md` at `open-gsd/gsd-core` (branch `next`), cross-checked against a real project's `.planning/config.json` (primary source, read directly — see file at `C:\Users\fgghk\PycharmProjects\GSD CONFIG MANAGER\.planning\config.json`). This is the "omit nothing" checklist for category-tab construction. Confidence: MEDIUM on doc-derived details (docs describe a moving-target schema and the maintainers themselves have had `VALID_CONFIG_KEYS` drift between `gsd-tools.cjs` and `sdk/src/config-schema.ts`); HIGH on anything confirmed present in the real example file.

### Chapter 1 — Core / Identity
`mode` (enum: `interactive`, `yolo`) · `granularity` (enum: `coarse`, `standard`, `fine`) · `model_profile` (enum: `quality`, `balanced`, `budget`, `adaptive`, `inherit`) · `runtime` (string: `claude`, `codex`, custom) · `context_window` (number, ≥500k enables adaptive enrichment) · `context` (freeform text injected into every agent prompt) · `response_language` (language code) · `project_code` (short prefix string) · `phase_naming` (string; example file shows enum-like value `"sequential"` — worth confirming whether this is free text or a closed enum) · `claude_md_path` (file path, default `./.claude/CLAUDE.md`) · `commit_docs` (boolean — appears at **top level** in the real example file in addition to `planning.commit_docs`; likely a legacy/duplicate top-level alias — flag for verification) · `search_gitignored` (boolean — also appears both top-level and under `planning.*` in the real file)

### Chapter 2 — Model & Routing
- `model_overrides` (map: agent-name → tier alias `opus`/`sonnet`/`haiku`/`inherit`/fully-qualified model ID)
- `model_profile_overrides` (map, present as `{}` in the real example file — **name differs from `model_overrides` in the docs; needs reconciliation during schema-build, likely two related-but-distinct override surfaces**)
- `models` (phase-type shortcuts, v1.40+): `planning`, `discuss`, `research`, `execution`, `verification`, `completion` — each a tier alias or `inherit`
- `model_policy` (v1.42+): `provider` (enum: `openai`, `anthropic`, `anthropic-fable`, `google`, `qwen`, `generic`), `budget` (enum: `high`/`medium`/`low`), `high`/`medium`/`low` (model ID strings), `runtime_tiers.<runtime>.<tier>` (object: `{model, reasoning_effort?}`)
- `dynamic_routing` (v1.40+, tier escalation): `enabled` (bool), `tier_models.{light,standard,heavy}` (tier aliases), `escalate_on_failure` (bool), `max_escalations` (int)
- `effort` (v1.42+, unified reasoning-effort ladder `minimal < low < medium < high < xhigh < max`): `default`, `routing_tier_defaults.{light,standard,heavy}`, `agent_overrides` (map: agent-name → effort level — **confirmed in real file with ~30 named agents**, e.g. `gsd-planner`, `gsd-executor`, `gsd-verifier`, `gsd-security-auditor`, `gsd-debugger`, etc.)
- `fast_mode` (v1.42+, same shape as `effort` but boolean values): `enabled`, `routing_tier_defaults.{light,standard,heavy}`, `agent_overrides`
- `resolve_model_ids` (string, e.g. `"omit"` — used for non-Claude runtimes)
- `granularities` (map, present as `{}` in real file — per-phase-type granularity overrides, needs schema confirmation)

**Model Profile structure (for the Model Profile editor):** 5 shipped profiles — `quality`, `balanced`, `budget`, `adaptive`, `inherit` — each assigning a tier (`opus`/`sonnet`/`haiku`, or session-inherit) per agent role. Underlying data comes from a shared catalog (referenced in docs as `sdk/shared/model-catalog.json`, ~33 shipped agents, each with an explicit tier per profile). Representative agent roster confirmed from the real example file's `effort.agent_overrides` block: `gsd-planner`, `gsd-roadmapper`, `gsd-executor`, `gsd-verifier`, `gsd-security-auditor`, `gsd-plan-checker`, `gsd-code-reviewer`, `gsd-code-fixer`, `gsd-debugger`, `gsd-debug-session-manager`, `gsd-assumptions-analyzer`, `gsd-eval-auditor`, `gsd-eval-planner`, `gsd-framework-selector`, `gsd-integration-checker`, `gsd-nyquist-auditor`, `gsd-ai-researcher`, `gsd-advisor-researcher`, `gsd-domain-researcher`, `gsd-research-synthesizer`, `gsd-user-profiler`, `gsd-ui-checker`, `gsd-ui-auditor`, `gsd-doc-verifier`, `gsd-phase-researcher`, `gsd-project-researcher`, `gsd-ui-researcher`, `gsd-pattern-mapper`, `gsd-doc-writer`, `gsd-doc-classifier`, `gsd-doc-synthesizer`, `gsd-mempalace-curator`, `gsd-intel-updater`, `gsd-codebase-mapper`. This list should be treated as the seed for the agent-picker in the Model Profile matrix editor, refreshed from the live catalog when possible.

### Chapter 3 — Workflow Toggles (`workflow.*`, largest chapter — "absent = enabled" for most booleans)
Grouped by the same sub-sections gsd-core's own `/gsd-settings` and `/gsd-config --advanced` commands use (good precedent for this tool's own sub-tabs):
- **Planning workflow:** `research`, `plan_check`, `pattern_mapper`, `nyquist_validation`, `ui_phase`, `ui_safety_gate`, `ai_integration_phase`, `research_before_questions`, `discuss_mode` (enum, e.g. `discuss`), `max_discuss_passes` (number), `skip_discuss` (bool), `post_planning_gaps`, `plan_bounce` (bool), `plan_bounce_script`, `plan_bounce_passes` (number), `plan_chunked` (bool), `plan_review_convergence` (bool), `plan_drift_precheck` (bool)
- **Execution:** `verifier`, `tdd_mode`, `code_review`, `code_review_depth` (enum, e.g. `deep`), `code_review_command`, `ui_review`, `node_repair` (bool), `node_repair_budget` (number), `use_worktrees` (bool), `auto_prune_state` (bool), `human_verify_mode` (enum, e.g. `end-of-phase`), `text_mode` (bool)
- **Cross-AI:** `cross_ai_execution` (bool), `cross_ai_command`, `cross_ai_timeout` (seconds, default `300`)
- **Security:** `security_enforcement` (bool), `security_asvs_level` (number 1-3), `security_block_on` (enum: `critical`/`high`/`medium`/`low`/`none`)
- **Build/Test:** `build_command`, `test_command`
- **Pipeline:** `auto_advance` (bool), `_auto_chain_active` (internal/likely read-only — should probably be hidden or shown as advanced/system state, not user-edited)
- **Additional toggles referenced in docs not present in the sampled real file (need presence-check during schema build):** `mvp_mode`, `api_coverage_gate`
- **Timeouts/thresholds (also under `workflow.*` per docs):** `subagent_timeout` (ms, default `300000`), `test_gate_timeout` (seconds, default `600`), `inline_plan_threshold` (number, default `3`), `drift_threshold` (number, default `3`)
- **Executor stall detection (top-level `executor.*` namespace, sibling to `workflow`, not nested inside it):** `executor.stall_detect_interval_minutes`, `executor.stall_threshold_minutes`

### Chapter 4 — Planning (`planning.*`)
`commit_docs` (bool) · `search_gitignored` (bool) · `sub_repos` (array of paths — multi-repo workspace support; **this is a "pool" candidate**)

### Chapter 5 — Git (`git.*`)
`branching_strategy` (enum: `none`, `phase`, `milestone`) · `base_branch` (string) · `create_tag` (bool) · `phase_branch_template` (template string, vars: `{phase} {slug} {milestone} {num} {quick} {padded_phase} {base_branch}`) · `milestone_branch_template` (template string) · `quick_branch_template` (string or null)

### Chapter 6 — Gates (`gates.*`, all booleans)
`confirm_project` · `confirm_phases` · `confirm_roadmap` · `confirm_breakdown` · `confirm_plan` · `execute_next_plan` · `issues_review` · `confirm_transition`

### Chapter 7 — Safety & Security
`safety.always_confirm_destructive` (bool) · `safety.always_confirm_external_services` (bool) · `security.injection_blocking` (bool)

### Chapter 8 — Code Quality (`code_quality.fallow.*`)
`enabled` (bool) · `scope` (enum: `phase`, `repo`) · `profile` (enum: `minimal`, `standard`, `strict`) · `mcp` (bool)

### Chapter 9 — Ship (`ship.*`)
`pr_body_sections` — **array of structured objects**, each with: `heading` (required string), `enabled` (bool, default true), `source` (fallback-chain string referencing artifacts like `PLAN.md ## Risks || PLAN.md ## Rollback`), `template` (markdown string with vars `{phase_number} {phase_name} {phase_dir} {base_branch} {padded_phase}`), `fallback` (default content string). Allowed source artifacts: `ROADMAP.md`, `PLAN.md`, `SUMMARY.md`, `VERIFICATION.md`, `STATE.md`, `REQUIREMENTS.md`, `CONTEXT.md`. **This is the flagship "pool" UI case** — a real structured-object array editor, not a scalar list.

### Chapter 10 — Review (`review.*`)
`default_reviewers` (array/null, e.g. `["gemini","codex"]`) · `reviewer_instances` (map of named external-reviewer configs, each `{cli, model, agent}`) · `models` (map: reviewer-name → model ID) · `max_prompt_tokens` (number) · `max_prompt_tokens_per_reviewer` (map: reviewer-name → number) · `ollama_host` / `lm_studio_host` / `llama_cpp_host` (URLs)

### Chapter 11 — Parallelization (`parallelization.*`)
`enabled` (bool) · `plan_level` (bool) · `task_level` (bool) · `skip_checkpoints` (bool) · `max_concurrent_agents` (number) · `min_plans_for_parallel` (number)

### Chapter 12 — Hooks & Statusline
`hooks.context_warnings` (bool) · `hooks.workflow_guard` (bool) · `statusline.context_position` (enum, e.g. `end`) · `statusline.show_last_command` (bool)

### Chapter 13 — Plan Review / Source Grounding (`plan_review.*`)
`source_grounding` (bool) · `source_grounding_authority` (enum: `grep`, `intel`, `treesitter`, `lsp`, `scip`)

### Chapter 14 — Agent Skills (`agent_skills.*`, `agent_skills_security.*`)
`agent_skills` — **map**: agent-name → array of skill references, three accepted reference forms (`"skills/my-skill"` local, `"global:<name>"` global, `"global:<plugin>:<skill>"` Claude plugin) · `agent_skills_security.trusted_global_roots` (array of filesystem paths)

### Chapter 15 — Features / Learnings / Intel
`features.thinking_partner` (bool) · `features.global_learnings` (bool) · `learnings.max_inject` (number) · `intel.enabled` (bool)

### Chapter 16 — Knowledge Graph (`graphify.*`, v1.36+)
`enabled` (bool) · `build_timeout` (seconds) · `auto_update` (bool) · `graph_path` (string, unset by default — multi-repo umbrella graph path)

### Chapter 17 — MemPalace Memory (`mempalace.*`, opt-in)
`enabled` (bool) · `memory_mode` (enum: `augment`, `kg_backend`, `replace`) · `wing` (string) · `recall_on_discuss` (bool) · `recall_on_plan` (bool) · `capture_artifacts` (bool) · `mirror_kg` (bool) · `cross_project_tunnels` (bool) · `diary_journal` (bool) · `auto_capture_hooks` (bool)

### Chapter 18 — Capability Trust (`capabilities.*`)
`strict_known_registries` (array or null; `null` = permissive, `[]` = local-only allowlist of install hosts) · `auto_update` (bool)

### Chapter 19 — Manager Passthrough (`manager.flags.*`)
Freeform map of CLI flags per command, e.g. `{discuss: "--auto", plan: "--skip-research", execute: "--validate"}` — likely needs a generic key/value editor rather than a fixed schema.

### Chapter 20 — CLAUDE.md Assembly (`claude_md_assembly.*`)
`mode` (enum: `embed`, `link`) · `blocks.<section>` (per-section enum override, inherits `mode` if unset)

### Chapter 21 — Integrations / Search API Keys
Top-level (not namespaced): `brave_search`, `firecrawl`, `exa_search`, `tavily_search`, `ref_search`, `perplexity`, `jina` — each accepts a string (API key, must be masked in UI as `****<last-4>`), or `true`/`false`/`null` (explicit override of auto-detection). **Security-sensitive chapter** — the config manager must mask these values by default in the UI and never log/export them in plaintext, given it's meant to be beginner-safe.

### Out-of-file scope (flag but do not attempt to edit)
`.claude/settings.local.json` → `worktree.baseRef` lives in the **Claude Code runtime settings file**, not `.planning/config.json` — outside this tool's stated scope (GSD config/defaults/model profiles) unless PROJECT.md scope is later expanded.

### Known Schema Ambiguities to Resolve During Schema-Build (not guessed here — flag for verification against multiple real project files / gsd-core source before finalizing the bundled schema)
1. `model_overrides` (per docs) vs. `model_profile_overrides` (present in the real sampled file) — likely two distinct concepts that got conflated in secondary sources; must read `sdk/src/config-schema.ts` directly (or equivalent canonical source) rather than docs prose to resolve.
2. `commit_docs` and `search_gitignored` appear both at the config **top level** and nested under `planning.*` in the real sampled file — confirm whether the top-level keys are deprecated aliases, distinct settings, or a doc/reality drift artifact.
3. `granularities` (plural, map, empty in sample) — purpose not documented in the fetched `CONFIGURATION.md`; likely per-phase-type granularity overrides mirroring the `models` phase-type pattern, but should be confirmed against source before writing beginner-facing copy.
4. gsd-core's own maintainers have documented `VALID_CONFIG_KEYS` drifting between `gsd-tools.cjs` and `sdk/src/config-schema.ts` (GitHub issue #3351) — meaning **even gsd-core's own canonical key list has had version-to-version inconsistency**. This is direct evidence supporting the project's "hybrid schema + live refresh + surface unknown keys" design decisions; it is not merely a nice-to-have.

---

## MVP Definition

### Launch With (v1)

- [ ] `npx` launch with local loopback helper serving UI + file I/O — required for the tool to exist at all
- [ ] Manual add of config file paths (file picker or path entry), persisted sidebar list — required for the core multi-config workflow
- [ ] Category-tabbed, schema-driven form covering the full bundled canonical schema (Chapters 1–21 above) — required by the explicit "omit nothing" constraint
- [ ] Plain-language docs per key and per enum option — this IS the Core Value; cannot be deferred
- [ ] Discovery + effective-value display of project `config.json` merged against global `~/.gsd/defaults.json`
- [ ] Generic array/map "pool" editor, applied at minimum to `ship.pr_body_sections`, `agent_skills`, `planning.sub_repos`, and the `effort`/`fast_mode`/`model_overrides` agent-keyed maps — required because raw-JSON editing of these is the exact failure mode the product prevents
- [ ] Validate-before-save + atomic write (temp file + rename)
- [ ] Unknown-key preservation on save (even without a polished "unknown keys" UI, data must never be dropped)
- [ ] Create new config from defaults
- [ ] Minimal version history (at least last-saved snapshot + revert), even if not yet a full browsable timeline

### Add After Validation (v1.x)

- [ ] Full multi-snapshot version history browser with diff view — add once users are actually making enough edits to need it
- [ ] Purpose-built Model Profile matrix editor (profiles × agents × tiers, create/edit custom profile) — high build cost; validate that users actually touch this chapter before over-investing
- [ ] Scoped folder-scan discovery helper — nice convenience once manual-add usage patterns are understood
- [ ] Live schema refresh/reconcile against the gsd-core GitHub repo — needed once gsd-core ships a version this tool's bundled schema doesn't yet cover

### Future Consideration (v2+)

- [ ] Cross-project bulk-edit (apply one setting change across many tracked configs) — defer until there's evidence users manage enough projects simultaneously to want this
- [ ] Scheduled/automatic schema-refresh checks with changelog-aware prompts — defer until manual refresh proves the reconciliation logic is safe
- [ ] Tool-native shareable setting presets/bundles (still local-file based) — defer; overlaps with gsd-core's own `~/.gsd/defaults.json` mechanism and needs a clear non-redundant value prop first

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Schema-driven category-tabbed form (all chapters) | HIGH | HIGH | P1 |
| Plain-language key + enum-option docs | HIGH | HIGH (content authoring) | P1 |
| Multi-config sidebar (manual add) | HIGH | LOW | P1 |
| Effective value (default vs. override) | HIGH | MEDIUM | P1 |
| Generic array/map pool editor | HIGH | MEDIUM-HIGH | P1 |
| Validate-before-save + atomic write | HIGH | MEDIUM | P1 |
| Unknown-key preservation | HIGH | LOW-MEDIUM | P1 |
| Create new config from defaults | MEDIUM | LOW | P1 |
| Minimal version snapshot + revert | MEDIUM-HIGH | MEDIUM | P1 |
| Full version history browser + diff | MEDIUM-HIGH | MEDIUM-HIGH | P2 |
| Purpose-built Model Profile matrix editor | HIGH (for power users) | HIGH | P2 |
| Folder-scan discovery | MEDIUM | MEDIUM | P2 |
| Live schema refresh/reconcile vs. gsd-core repo | HIGH (long-term) | HIGH | P2 |
| Bespoke `ship.pr_body_sections` structured-object pool UI | MEDIUM | MEDIUM | P2 |
| API key masking + secure display for integrations chapter | HIGH | LOW | P1 |
| Cross-project bulk edit | LOW-MEDIUM | HIGH | P3 |
| Scheduled schema-refresh automation | LOW | MEDIUM | P3 |
| Tool-native shareable presets | LOW | MEDIUM | P3 |

## Competitor / Reference-Pattern Analysis

| Feature | VS Code Settings UI | MetaConfigurator / json-editor (jdorn) | JSONBuddy | Our Approach |
|---------|----------------------|------------------------------------------|-----------|--------------|
| Search across settings | Yes, best-in-class | Limited/none in most implementations | Yes (schema pools browser) | Adopt VS Code's pattern: search by key/label/description |
| Field docs | Short technical description only | Schema `description` tooltip on hover | Schema title/description/constraints tooltip | Go further: full beginner prose per key AND per enum option — this is the differentiator, not table stakes |
| Default vs. modified indicator | Yes ("Modified" badge, gear icon to reset) | Not typical | Not typical | Adopt directly — proven UX |
| Array editing | N/A (VS Code settings rarely nested this deeply) | Add/remove/reorder with min/maxItems enforcement | Pool-based management of related schemas | Adopt json-editor's array UX as the base for our "pool" editor, specialized per real GSD shape |
| Multi-file management | N/A (single settings.json + workspace overrides) | N/A (single doc per session) | Yes, "schema pools" concept, closest analog | Purpose-built sidebar (persisted list of real project paths), simpler than JSONBuddy's abstract pools |
| Version history/diff | Delegates to git entirely | Delegates to source control | Delegates to source control | Differentiate: own snapshot store independent of user's git status |
| Schema evolution handling | N/A (VS Code owns its own schema, ships with the app) | User supplies schema; no live-fetch/reconcile feature found | Reload button re-applies pool config manually | Differentiate: automated fetch + diff against live `open-gsd/gsd-core`, not just a manual reload |
| Raw/text fallback | Yes (`settings.json` always editable directly) | MetaConfigurator explicitly offers dual text+GUI panels | Yes, JSON editor is the base surface | Offer schema-validated raw-JSON escape hatch per pool, never as the primary/only path |

## Sources

- **Primary (HIGH confidence):** `.planning/config.json` — a real, in-use gsd-core project configuration file, read directly from disk at `C:\Users\fgghk\PycharmProjects\GSD CONFIG MANAGER\.planning\config.json`. Used to confirm actual field names, nesting, and to catch discrepancies against the documentation (see "Known Schema Ambiguities").
- **gsd-core documentation (MEDIUM confidence, cross-checked across 3 fetches):**
  - `docs/CONFIGURATION.md` at `open-gsd/gsd-core` (branch `next`) — https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md (primary schema reference for chapters 1–21)
  - `docs/COMMANDS.md` at `open-gsd/gsd-core` (branch `next`) — https://github.com/open-gsd/gsd-core/blob/next/docs/COMMANDS.md (confirms the `/gsd-settings` and `/gsd-config` category groupings, a strong precedent for this tool's own tab structure)
  - `www.opengsd.net/docs/v1/configuration` (published docs site mirror) — used to confirm defaults-file location (`~/.gsd/defaults.json`, global, no project-level `defaults.json`)
  - `github.com/gsd-build/get-shit-done` issues #3351 and #3210 (config schema module / `VALID_CONFIG_KEYS` drift) — direct evidence for the "hybrid schema + refresh + surface unknown keys" design rationale
  - `docs.bswen.com/blog/2026-04-21-gsd-model-profiles` — secondary blog summary of the four/five-profile model system, used only as corroboration, not as primary source
- **Generic config-editor UX best practices (MEDIUM-HIGH confidence, established open-source tools):**
  - `github.com/json-editor/json-editor` (formerly jdorn/json-editor) — array handling, validation API shape (`{path, property, message}`)
  - MetaConfigurator (Springer/Datenbank-Spektrum paper, "A User-Friendly Tool for Editing Structured Data Files") — dual text/GUI panel pattern, inline validation highlighting, safe-delete confirmation
  - JSONBuddy blog — "schema pools" concept for multi-schema management
  - `offlinetools.org` — JSON config schema-versioning best practices (informed the "never silently drop unknown keys" and atomic-write recommendations)
- **VS Code Settings UI** — used from general product knowledge as the reference implementation for search, default/modified indicators, and reset-to-default; no single citable doc, but this is a widely observed, stable UX pattern.

---
*Feature research for: gsd-core configuration manager (local, npx-based, beginner-friendly)*
*Researched: 2026-07-11*
