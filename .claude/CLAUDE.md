<!-- GSD:project-start source:PROJECT.md -->

## Project

**GSD Config Manager**

A beautiful, zero-config-friendly desktop-grade tool for viewing, understanding, and safely editing GSD (open-gsd/gsd-core) configuration files across all of a developer's projects. It ships as a public npm package launched with a single `npx` command, which starts a small local (loopback) helper and opens a rich browser UI. Every config key is organized into category tabs and documented in plain language — what each field does, and what each possible option means — so even a beginner can confidently configure GSD. It manages multiple config files at once through a left sidebar, protects against corruption and data loss with validation and full version history, and provides first-class editing and creation of GSD model profiles.

**Core Value:** A user can open any GSD `config.json`, understand exactly what every setting and option means, and change it correctly and safely — without ever reading the gsd-core source or docs.

### Constraints

- **Tech stack**: React + Vite + TypeScript frontend; Node-based CLI/local helper for launch and file I/O — Assumed for a rich, maintainable, `npx`-friendly UI.
- **Architecture**: No hosted server; local loopback helper only — Explicit user requirement ("no server needed").
- **Distribution**: Published as a public npm package, single-command launch — Explicit requirement (easy to share and use).
- **Data safety**: Validate → atomic write → snapshot history/revert — Explicit requirement (prevent corruption/data loss).
- **Completeness**: Every canonical config key must be representable and documented — Explicit requirement (omit absolutely nothing).
- **Compatibility**: Must track evolving gsd-core config schema across versions — Follows from bundled + repo-refresh schema strategy.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js (engines floor) | `>=20.19` (target/dev on 22 or 24 LTS) | Runtime | Node 20 reached EOL April 2026; Node 22 is Maintenance LTS, Node 24 is Active LTS (support to Apr 2028). `>=20.19` matches Vite 8's floor while excluding only already-dead runtimes. |
| TypeScript | **5.9.3** (NOT `latest`/7.x) | Language for both frontend and backend | TypeScript 7.0 (the Go-native "tsgo" compiler, Project Corsa) reached GA **2026-07-08 — 3 days before this research**. It has no stable programmatic API until 7.1, and much of the plugin ecosystem (ts-eslint, some bundler integrations) has not caught up. Pin `5.9.3`, the last mature Strada (JS-based) release, for a project starting today; revisit 7.x once `typescript-eslint`, `vite`, and `tsup` confirm full support. |
| Vite | **8.1.4** | Frontend build tool (dev server + production bundle) | Current major; requires Node `^20.19 || >=22.12`, which sets the realistic floor for this whole project. Fast HMR during development, first-class React + TS support via `@vitejs/plugin-react`. |
| React | **19.2.7** | UI library | Current stable major; assumed per project constraints. |
| Fastify | **5.10.0** | Local loopback HTTP helper (serves bundled UI + JSON API for file I/O) | 2026 community default for new small Node servers: built-in JSON-Schema (Ajv) request/response validation (reuses the same Ajv already chosen for config validation), first-class TypeScript types, radix-tree routing, `@fastify/static` for serving the bundled SPA. Express is fine for trivial cases but has no built-in schema validation — a poor fit when Ajv is already the project's single source of truth for validation. |
| Ajv | **8.20.0** (+ `ajv-formats` 3.0.1) | JSON Schema validation engine — the single validation source of truth, used both server-side (pre-write gate) and client-side (live form feedback) | JIT-compiled, ~7x faster than Zod on simple schemas, is the reference implementation for JSON Schema (the format the project's canonical schema is already committed to). Fastify itself uses Ajv 8 internally, so there's no duplicate/conflicting Ajv version in the dependency tree. |
| Commander | **15.0.0** | CLI argument parsing for the `npx <package>` entry point | Zero runtime dependencies, ~400M weekly downloads, the de-facto standard for "a binary with a handful of flags" (`--port`, `--no-open`, `--scan <dir>`). Yargs/oclif add weight and complexity this tool doesn't need. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `open` | **11.0.0** | Programmatically open the user's default browser after the helper starts | Standard, Sindre Sorhus-maintained; used by nearly every "CLI that opens a browser" tool (create-react-app's `react-dev-utils`, Storybook, etc.). Requires Node `>=20`, consistent with the floor above. |
| `get-port` | **7.2.0** | Find a free loopback port automatically | Avoids EADDRINUSE when the user runs the tool twice or has other local servers running; supports a preferred-port-with-fallback pattern. |
| `@fastify/static` | **10.1.0** | Serve the built Vite `dist/client` assets from the Fastify server | Purpose-built plugin, avoids hand-rolling static file serving/caching headers. |
| `@fastify/cors` | **11.3.0** | Lock down `Origin` on the local API | Even though the server is loopback-only, browsers still let *any* open tab issue `fetch()` to `127.0.0.1`. Combine with a per-session random token (see Architecture note below) — do not rely on loopback binding alone. |
| `react-hook-form` | **7.81.0** | Form state/orchestration for hand-built config-field components | Uncontrolled-input performance model scales to a config with hundreds of fields across many tabs; `useFieldArray` is the direct mechanism for the required "array-valued keys edited as pools" (add/remove/reorder) requirement. |
| `@hookform/resolvers` (the `/ajv` entry) | **5.4.0** | Bridges Ajv → react-hook-form | Ships an official `ajvResolver`, so the *same* Ajv schema instance used server-side for the pre-write gate also drives live client-side field errors — one schema, no duplication. |
| `write-file-atomic` | **7.0.1** (pin explicitly — do not float to `^8`) | Atomic writes: write to temp file, `fsync`, rename over target | Maintained by the npm CLI org; this is the exact mechanism `npm` itself uses to avoid partial/corrupted config files. **Do not use `latest` (8.0.0)** — it raises the Node engines floor to `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`, i.e. very recent LTS *patch* releases; `7.0.1` (`^20.17 \|\| >=22.9`) matches this project's realistic floor without forcing users onto a bleeding-edge patch version. |
| `proper-lockfile` | **4.1.2** | Advisory file locking to prevent a write race if the same config file is touched concurrently (two browser tabs, or the GSD CLI writing while the UI has the file open) | Mkdir-based lock, used historically by Lerna/VS Code-adjacent tooling. **Caution:** last published 2021 (no recent commits) — functionally simple and stable ("finished" software) but flag as a maintenance risk; re-evaluate if a CVE or Node-version incompatibility ever surfaces. |
| `chokidar` | **5.0.0** | Watch tracked config files / scanned folders for out-of-band changes (e.g., user or `gsd` CLI edits the file directly) | Lets the UI show "this file changed on disk" and offer reload, avoiding silently overwriting external edits. |
| `zustand` | **5.0.14** | Client UI state: sidebar selection, active tab, panel/modal state | ~1–3KB, no Provider, hook-based — the 2026 default for local component/app state. |
| `@tanstack/react-query` | **5.101.2** | Server-state layer for the local REST API (fetch/save config, cache invalidation, retries, optimistic UI on save) | Standard pairing with Zustand: Zustand owns UI state, TanStack Query owns anything that round-trips through the local HTTP API. |
| `json-diff-kit` | **1.0.35** | Structural JSON diff engine + built-in React `Viewer` component, used for the version-history diff view | Purpose-built for diffing **JS objects** (not text) — critical because GSD's `config.json` is large/deeply nested, and a text-based diff (e.g. `react-diff-viewer`) would show noisy false "line changes" whenever key order shifts. Actively maintained (published Mar 2026), includes virtual-scroll support if a diff ever gets very large. |
| `@codemirror/lang-json` + `codemirror` (CM6) | **6.0.2** / **6.0.2** | Raw-JSON fallback/power-user editor, with Ajv-driven inline error squiggles | Modular, tree-shakeable, ~50KB core. **Not Monaco** — see "What NOT to Use." |
| `tsup` | **8.5.1** | Bundle the Node CLI/server TypeScript source (esbuild-powered) into the publishable `dist/cli.js` (CJS or dual ESM/CJS) | Zero-config esbuild wrapper, the standard choice for bundling small Node CLI/library packages in 2025/2026 (distinct build step from Vite, which only builds the frontend). |
| `@vitejs/plugin-react` | **6.0.3** | React JSX/Fast Refresh support in Vite | Required companion to Vite for a React app. |
| `tailwindcss` | **4.3.2** | Styling for the "visually rich, polished" UI bar the project requires | Utility-first, pairs naturally with the shadcn/Radix component pattern below; avoids hand-writing a full CSS design system from scratch. |
| `@radix-ui/react-*` (`react-tabs`, `react-dialog`, etc.) + `shadcn` CLI | **1.1.x** / **4.13.0** | Accessible unstyled primitives for category tabs, dialogs (revert confirmation), etc., scaffolded via the `shadcn` CLI | Gives WAI-ARIA-correct tab/dialog/dropdown behavior "for free" while keeping full visual control (components are copied into the repo, not a black-box dependency) — matches the "hand-built, schema-driven, not auto-generated" UI approach below. |
| `class-variance-authority` + `tailwind-merge` + `clsx` | 0.7.1 / 3.6.0 / 2.1.1 | Component variant styling helpers, standard companions to the shadcn/Tailwind pattern | Only needed if adopting the shadcn component pattern above. |
| `lucide-react` | **1.24.0** | Icon set | Standard companion to shadcn-style UIs. |
| `vitest` | **4.1.10** | Unit/integration tests for both the Node file-I/O layer and React components | Native Vite integration (shares config/transform pipeline), fast, Jest-compatible API. |
| `playwright` | **1.61.1** | End-to-end tests driving the actual local server + browser UI | Needed to test the "does saving actually round-trip to disk correctly, does revert work" flows realistically. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsup` (backend) + `vite build` (frontend) | Two separate build steps combined into one `npm run build` / `prepublishOnly` script | Standard 2025/2026 split for "Node CLI that ships a bundled web frontend" packages: `dist/client/**` (Vite output, served statically) + `dist/cli.js` (tsup output, the `bin` entry). |
| `npm pack --dry-run` | Verify exactly which files ship in the published tarball before every release | Critical here because the frontend build output lives *inside* the npm package (no CDN) — accidentally excluding `dist/client` breaks the tool entirely, and accidentally including `node_modules`/source maps bloats every `npx` install. |

## Installation

# Core (CLI + server)

# Frontend

# Dev dependencies

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Fastify | Express 5 | If the team already knows Express deeply and the API surface stays under ~10 routes; you lose built-in Ajv-schema route validation and must wire it manually. |
| Fastify | Node's built-in `http`/`node:http` module directly | If minimizing `npx` install size/time is the single overriding priority and the API truly never grows past a handful of hand-rolled routes — but you then re-implement static file serving, routing, and schema validation yourself. |
| Commander | `cac` | If bundle/install size is the top priority (~5KB vs Commander's ~48KB) — same expressive power for a small CLI, but far smaller ecosystem/precedent. |
| Zustand + TanStack Query | Redux Toolkit (+ RTK Query) | Only if the team anticipates a much larger contributor base and wants Redux DevTools time-travel debugging and enforced action-log auditability — unnecessary ceremony for a local single-user tool. |
| Zustand | Jotai | If profiling later shows excessive re-renders from a single large Zustand store while editing deeply nested config forms — Jotai's atomic model gives more surgical re-render control at the cost of a different mental model. |
| Ajv (sole validator) | Zod / Valibot | Only if the project ever *stops* treating JSON Schema as the canonical schema format. Since the project's own constraints commit to a "curated canonical JSON Schema... reconciled against gsd-core," introducing Zod/Valibot in parallel would mean maintaining two schema languages for the same data — avoid. |
| Hand-built schema-driven forms (RHF + schema metadata) | `react-jsonschema-form` (RJSF) / JSONForms | If shipping speed matters more than visual polish, or the team is comfortable investing in RJSF's theming/registry system to hit the "beautiful, polished" bar — plausible, but fights the project's explicit requirement for guided "pool" editors and rich inline help copy. |
| CodeMirror 6 | Monaco Editor (`@monaco-editor/react`) | Only if full VS Code-grade IntelliSense/LSP editing of raw JSON becomes a first-class requirement (it isn't — guided forms are primary, raw JSON is a power-user escape hatch). Monaco adds 2–5MB that ships inside every `npx` install of this package. |
| json-diff-kit | `jsondiffpatch` (engine only, no bundled React viewer) or `react-diff-viewer-continued` (text-based) | `jsondiffpatch` if you want to hand-roll a fully custom diff renderer; `react-diff-viewer-continued` only if you decide to diff pretty-printed JSON *as text* (not recommended — reordering keys produces misleading full-line diffs). |
| Filesystem snapshot history (timestamped copies + `json-diff-kit`) | `isomorphic-git`-backed shadow history (real git commits per save) | If the team wants true git semantics (branching, arbitrary-point checkout) for history and is willing to manage an isolated git repo location that never touches the user's actual project `.git` — meaningfully more powerful but materially more complex and riskier to get isolation right. |
| `write-file-atomic@7` | `write-file-atomic@8` (latest) | Once your engines floor is comfortably on very recent Node 22/24/26 patch releases (`^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`) — not yet, for a tool targeting the broadest developer audience today. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| TypeScript `latest` (7.0.x, "tsgo") pinned today | GA'd 3 days before this research (2026-07-08); no stable programmatic compiler API until 7.1, meaning some build/lint tooling may not yet integrate cleanly. Adopting it on day one of a new project risks chasing ecosystem breakage instead of building the product. | TypeScript `5.9.3` now; revisit 7.x once `tsup`/`vite`/`typescript-eslint` confirm full support (likely within a few months). |
| Zod or Valibot as a *second* schema/validation layer alongside Ajv/JSON Schema | The project's own schema strategy is explicitly JSON-Schema-based (curated canonical schema + reconciliation against gsd-core). Adding a TypeScript-first validator in parallel means two schema languages describing the same data, which *will* drift. | Ajv only, driven by the single canonical JSON Schema; use `@hookform/resolvers/ajv` to wire it into forms. |
| Monaco Editor as the primary/only editing surface | 2–5MB bundle that, in this architecture, ships **inside the published npm tarball** (not lazy-loaded from a CDN), bloating every `npx` install; also massive overkill for a tool whose primary UX is guided forms, not free-form code editing. | CodeMirror 6 for the raw-JSON fallback view; keep guided forms as the primary editing surface. |
| `react-jsonschema-form` (RJSF) or JSONForms as the *primary* rendering engine for the main config editor | Both are optimized for "generate a usable form fast," not for hand-crafted visual polish with rich inline explanations and custom "pool" array controls — their theming/registry indirection actively fights bespoke design work. | Use the JSON Schema purely as validation + metadata (types, enums, descriptions); hand-build tab/field/pool components with `react-hook-form`. |
| Binding the local Fastify server to `0.0.0.0` (or trusting loopback binding alone as "secure") | Any web page open in the user's browser can still issue `fetch()` requests to `http://127.0.0.1:<port>` (the classic "local server" DNS-rebinding/CSRF class of vulnerability that has bitten Ollama and other local-tool servers). Loopback binding stops *other machines*, not other browser tabs. | Bind `127.0.0.1` explicitly **and** require a per-session random token (embedded in the auto-opened URL, checked on every API request) plus an `Origin`/`Referer` check via `@fastify/cors` — mirrors the pattern used by Jupyter, MCP Inspector, and Prisma Studio. |
| `pkg` / Node SEA (Single Executable Applications) to produce a standalone binary | Solves a problem this project doesn't have — `npx` already guarantees a Node runtime is present, so there's no need to bundle Node itself. Adds cross-compilation complexity for no benefit. | Standard npm `bin` field + shebang (`#!/usr/bin/env node`); npm auto-generates the Windows `.cmd`/PowerShell wrapper. |
| `proper-lockfile` (or any file lock) as a substitute for atomic writes | Locking prevents *concurrent* writers from racing; it does nothing to prevent a *partial/corrupted* write if the process crashes mid-write. | Always pair locking with `write-file-atomic` (temp file + fsync + rename) — locking and atomicity solve different halves of the safety requirement. |

## Stack Patterns by Variant

- Use `react-jsonschema-form` (RJSF) with the `@rjsf/validator-ajv8` binding (reuses the same Ajv instance) instead of hand-built forms.
- Because RJSF auto-generates category groupings and array "pool" controls out of the box, trading the bespoke-polish requirement for materially less frontend code.
- Swap `json-diff-kit`'s built-in `Viewer` for the `virtual-react-json-diff` wrapper (same engine, adds `react-window` virtualization).
- Because GSD's `config.json`/`defaults.json` are described as "large and deeply nested" but not yet confirmed to be at the tens-of-thousands-of-lines scale that requires virtualization.
- Use `isomorphic-git` to maintain a shadow repository in an isolated location (e.g. an OS app-data directory, never the user's project `.git`).
- Because it's a pure-JS git implementation (no native `git` binary dependency, critical for a cross-platform `npx` tool that can't assume `git` is installed) — but only take this on if the added complexity (repo isolation, garbage collection, corruption edge cases) is worth it over the simpler snapshot approach.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `fastify@5.10.0` | `ajv@8.20.0` | Fastify 5 uses Ajv 8 internally for route schema validation — installing the project's own `ajv@8.x` avoids a duplicate/mismatched Ajv in `node_modules`. |
| `vite@8.1.4` | Node `^20.19.0 \|\| >=22.12.0` | This is the tightest constraint in the stack and effectively sets the whole project's Node engines floor. |
| `write-file-atomic@8.0.0` | Node `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | Do not adopt yet — floor is stricter than Vite's; use `7.0.1` (`^20.17 \|\| >=22.9`) instead. |
| `react-hook-form@7.81.0` | `@hookform/resolvers@^5.x` (peer: `react-hook-form@^7.55.0`) | Confirmed compatible; `ajvResolver` is imported from `@hookform/resolvers/ajv`. |
| `typescript@5.9.3` | `vite@8`, `tsup@8.5.1`, `vitest@4.1.10` | All current-generation tooling targets TS 5.x programmatic APIs; do not jump to TS 7.x until these confirm support. |
| `@vitejs/plugin-react@6.0.3` | `vite@8.x`, `react@19.x` | Matched major-version triad; verify on install since plugin-react majors track Vite majors closely. |

## Sources

- `registry.npmjs.org` (direct API queries, 2026-07-11) — authoritative current version numbers for every package listed above (HIGH confidence: this is the canonical source of truth for npm package versions/engines, equivalent in weight to official docs).
- Web search (Exa, cross-checked across multiple independently-published 2026 sources) — architecture patterns (loopback + token security model per MCP Inspector/Codex WebApp/Prisma-Studio-style precedents), Fastify-vs-Express, Zustand-vs-Redux-vs-Jotai, Ajv-vs-Zod-vs-Valibot, RJSF-vs-hand-built-forms, Monaco-vs-CodeMirror, Commander-vs-Yargs-vs-cac, npm `bin`/shebang cross-platform packaging (MEDIUM confidence — ecosystem-trend and comparative judgments, not single-source claims).
- `devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc` and related July 2026 coverage — TypeScript 7.0 GA timing (2026-07-08) and its lack of a stable programmatic API pre-7.1 (MEDIUM confidence, cross-checked across multiple outlets).
- `npmjs.com/package/json-diff-kit` (direct package page fetch, 2026-07-11) — confirmed `Differ`/`Viewer` API and active maintenance (last publish March 2026) (HIGH confidence — primary source).

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
