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

## Installation

Requires **Node.js ≥ 20.19**. No account, no config, no build step on your machine.

### Run once, no install (recommended to try it)

```bash
npx open-gsd-core-config-manager
```

`npx` downloads the package into a cache, runs it, and your browser opens. Nothing is added to your project.

### Install globally (available as a command everywhere)

```bash
npm install -g open-gsd-core-config-manager
open-gsd-core-config-manager
```

Also installs a shorter alias, `gsd-config-editor` — identical binary.

### Install into a project (as a dev dependency)

```bash
npm install --save-dev open-gsd-core-config-manager
npx open-gsd-core-config-manager
```

Use this if you want the version pinned by your project's lockfile.

### Options

```bash
open-gsd-core-config-manager --no-open        # don't auto-open the browser
open-gsd-core-config-manager --port 4321      # fixed port (default: OS-assigned ephemeral)
open-gsd-core-config-manager --help           # full flag list
```

The server prints its URL on startup. It binds `127.0.0.1` only, so that URL is reachable from your machine and nowhere else.

## Getting started

Run the command, then: click **Add** → *Add existing config…* (or **Scan a folder…** to discover configs automatically), pick any project's `.planning/config.json`, and start exploring. The **Search providers** card at the top of the editor is where you set API keys for the optional search integrations.

## Uninstalling

```bash
npm uninstall -g open-gsd-core-config-manager   # global install
npm uninstall open-gsd-core-config-manager      # project install
```

The npm package and its command are removed. **Your data is not** — this tool deliberately never deletes your work:

| What | Where | Safe to delete? |
|---|---|---|
| Config snapshots / version history | `~/Library/Application Support/open-gsd-core-config-manager` (macOS) · `%LOCALAPPDATA%\open-gsd-core-config-manager\Data` (Windows) · `~/.local/share/open-gsd-core-config-manager` (Linux) | Yes, if you don't need restore history |
| Search-provider API keys | `~/.gsd/<provider>_api_key` | Only if you want the keys gone — **losing these means re-issuing them at the provider** |
| Your `.planning/config.json` files | your projects | **Never touched by this tool** |

Delete the app-data directory to remove the tool completely:

```bash
# macOS / Linux
rm -rf ~/.local/share/open-gsd-core-config-manager        # or ~/Library/Application Support/…
# Windows PowerShell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\open-gsd-core-config-manager"
```

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
