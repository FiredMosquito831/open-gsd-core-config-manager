# GSD Config Manager

**Understand and safely edit any [GSD (open-gsd/gsd-core)](https://github.com/open-gsd/gsd-core) `config.json` — without ever reading the gsd-core source or docs.**

One command. A local, private, browser-based editor for every GSD config across all of your projects:

```bash
npx open-gsd-core-config-manager
```

That's it. A helper starts on `127.0.0.1` (loopback only — nothing leaves your machine), your browser opens, and every setting is organized into categories with plain-language explanations of what it does and what every option means.

---

## Why

GSD's `config.json` is powerful but opaque: dozens of nested keys, magic enum values, model-routing maps, and settings whose behavior is only discoverable by reading source code. This tool makes every key self-explanatory:

- **Every key documented in plain language** — what the setting does, when you'd change it, and what each possible option means.
- **Every value safe to change** — validation before write, atomic writes, and a full snapshot history with one-click restore.
- **Nothing to deploy** — no hosted server, no account, no telemetry. It's a local helper + a web UI, launched from npx.

## Features

### Guided editing
- **Category chapters** organize all 200+ canonical keys (tracked against gsd-core releases).
- **Explain-then-edit cards** show the human label, a one-line summary, the effective value vs. default, and *where* the current value comes from (canonical default → global defaults `~/.gsd/defaults.json` → project override) before you touch anything.
- **Searchable dropdowns**: enums with more than a handful of options become filter-as-you-type comboboxes showing each option *and its meaning*.
- **Structured editors for arrays & maps** — agent skill maps, model overrides per runtime tier, reviewer instances: add/remove entries interactively instead of hand-editing JSON.

### Safety model
- **Validate → atomic write → snapshot**: Ajv validates against the canonical schema; saves go through `write-file-atomic`; every successful save snapshots the previous file.
- **Version history & restore** — browse snapshots, diff them structurally (not as noisy text), restore any point with a confirmation flow that never touches bytes until you confirm.
- **Stale-write protection** — if the file changed on disk while you were editing, your save is rejected rather than clobbering someone else's change.
- **Truthful save state** — the save bar always tells you exactly where you stand: clean / unsaved changes / saving / saved / blocked-with-reasons.

### Multi-project tracking
- Track any number of `.planning/config.json` files across projects; they're listed by project name with live status (`Ready` / missing / invalid).
- Scan a folder to discover configs, add by absolute path, or create a fresh one.

### Schema maintenance
- The bundled schema tracks gsd-core releases. One click checks the latest stable release, reviews proposed changes in plain language, and activates the refreshed schema — or keeps your current one.

### API keys for optional search providers
- GSD's optional search providers (Brave, Firecrawl, Exa, Tavily, Ref, Perplexity, Jina) need API keys, deliverable via **either** an environment variable (`<PREFIX>_API_KEY`) **or** a key file (`~/.gsd/<prefix>_api_key`). The tool detects both channels, shows their status inline in the editor, and can store keys to either or both — masked, mode `0600`, never logged.
- Raw JSON editing (CodeMirror), global search across keys/descriptions/option meanings, dark-first theme with light mode, keyboard shortcuts (`Ctrl+S`, `/`).

## Getting started

Requirements: **Node.js ≥ 20.19**.

```bash
# launch (builds on first run)
npx open-gsd-core-config-manager

# don't auto-open the browser
npx open-gsd-core-config-manager --no-open

# fixed port (default: OS-assigned ephemeral port)
npx open-gsd-core-config-manager --port 4321
```

Then: click **Add** → *Add existing config…* (or scan a folder), pick any project's `.planning/config.json`, and start exploring.

## Security model

This is a **local-only** tool by design:

- Binds strictly to `127.0.0.1` — never a network interface.
- Host allowlist (DNS-rebinding defense) + exact-string Origin guard on every API route reject cross-host/cross-origin callers.
- No accounts, no analytics, no outbound calls except the explicit schema-update check you trigger (which reads only allowlisted release metadata and never executes remote code).
- API keys are written mode `0600`, displayed masked, never logged.

## Documentation

- **[Canonical schema](docs/canonical-schema.json)** — every known gsd-core config key with its type, **default value**, allowed values (with per-option meanings), and description. This is the single reference this tool's UI is generated from. Regenerated per tracked gsd-core release.
- [`docs/`](docs/) — architecture notes and schema maintenance details.

## Development

```bash
npm install
npm run build        # tsup (CLI/server) + vite (frontend) into dist/
npm test             # vitest unit/integration suites
npx playwright test  # end-to-end suite (spawns the real server)
npm run cli:start    # run from dist/
```

Architecture at a glance:

| Package | Role |
|---|---|
| `packages/cli` | Commander entry, loopback bootstrap, graceful shutdown |
| `packages/server` | Fastify API: configs, workspace tracking, history/snapshots, schema lifecycle, picker, keys |
| `packages/config-io` | Load/validate/save pipeline (Ajv, atomic writes, revisions) |
| `packages/schema-data` | Bundled canonical schema + curated docs, reconciled against gsd-core |
| `web/` | React 19 + Vite SPA: schema-driven forms, history, schema & keys workspaces |

## Status

Actively developed against gsd-core **v1.11.0**. The bundled schema covers **201 keys** (192 with canonical defaults). If gsd-core ships new keys, use **Schema maintenance → Check for updates** in the app, or file an issue here.

## License

MIT
