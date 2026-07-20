# Phase 6: Live Schema Reconcile Against gsd-core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 6-Live Schema Reconcile Against gsd-core
**Areas discussed:** Refresh source and version, Change classification and review, Activation persistence and recovery, Refresh entry point and freshness status

---

## Refresh Source and Version

### Upstream release line

| Option | Description | Selected |
|--------|-------------|----------|
| Latest stable | Resolve the newest stable gsd-core release and record its immutable version/commit; avoids prerelease schema churn. | ✓ |
| Installed version | Match the gsd-core version installed on this machine. | |
| Stable or preview | Default to stable with an explicit prerelease/next opt-in. | |

**User's choice:** Latest stable.

### Version selection

| Option | Description | Selected |
|--------|-------------|----------|
| Latest only | One predictable Refresh action targets latest stable. | ✓ |
| Choose a release | Let users select any published stable version. | |
| Installed + latest | Offer locally installed or latest stable. | |

**User's choice:** Latest only.

### Incomplete or conflicting evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Fail the refresh | Activate nothing unless all required evidence parses and passes consistency checks. | ✓ |
| Preview partial data | Show partial trustworthy differences but disable activation. | |
| Merge best effort | Use valid sources and warn about missing evidence. | |

**User's choice:** Fail the refresh.

### Transport

| Option | Description | Selected |
|--------|-------------|----------|
| Pinned archive | Download the immutable tagged archive under strict limits and parse allowlisted files as inert data. | ✓ |
| Individual raw files | Fetch allowlisted files from an immutable release commit. | |
| GitHub API contents | Read tree and files through GitHub APIs. | |

**User's choice:** Pinned archive.

---

## Change Classification and Review

### Difference scope

| Option | Description | Selected |
|--------|-------------|----------|
| All meaningful metadata | Show presence, type, values, default, shape, deprecation, and relevant documentation changes. | ✓ |
| Structure only | Exclude documentation differences. | |
| Key lifecycle only | Show only added and missing keys. | |

**User's choice:** All meaningful metadata.

### Missing upstream keys

| Option | Description | Selected |
|--------|-------------|----------|
| Retain as deprecated | Keep the key known and documented with deprecation evidence. | ✓ |
| Remove after warning | Drop it after activation so older files surface it as unknown. | |
| Require per-key choice | Ask the user how to handle each missing key. | |

**User's choice:** Retain as deprecated.

### Curated documentation drift

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve and flag drift | Keep curated text active and flag upstream prose changes for later editorial review. | ✓ |
| Preserve silently | Keep curated text without showing prose differences. | |
| Replace with upstream | Overwrite curation with upstream documentation. | |

**User's choice:** Preserve and flag drift.

### Merge control

| Option | Description | Selected |
|--------|-------------|----------|
| Accept or cancel whole refresh | Activate one coherent validated proposal or cancel. | ✓ |
| Choose change groups | Accept additions, changes, and deprecations independently. | |
| Choose individual keys | Construct a custom per-key mixed schema. | |

**User's choice:** Accept or cancel whole refresh.

---

## Activation, Persistence, and Recovery

### Active lifetime

| Option | Description | Selected |
|--------|-------------|----------|
| Persist across launches | Store the accepted schema in app data for future launches. | ✓ |
| Current launch only | Return to bundled when the helper exits. | |
| Until app update | Persist but discard on any package update. | |

**User's choice:** Persist across launches.

### Bundle versus persisted refresh precedence

| Option | Description | Selected |
|--------|-------------|----------|
| Use the newer source version | Select whichever valid schema targets the newer gsd-core release. | ✓ |
| Refreshed always wins | Persisted refresh wins until explicit reset. | |
| Bundle always resets | Any package update restores bundled schema. | |

**User's choice:** Use the newer source version.

### Recovery control

| Option | Description | Selected |
|--------|-------------|----------|
| Reset to bundled | Explicitly deactivate/remove the override and atomically restore bundled rendering and validation. | ✓ |
| Automatic fallback only | No user-facing reset. | |
| Schema version history | Retain and restore multiple past schemas. | |

**User's choice:** Reset to bundled.

### Invalid persisted override

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back and warn | Start with bundled schema, ignore/quarantine the bad override, and show an actionable warning. | ✓ |
| Block startup | Refuse to open until manually repaired. | |
| Fall back silently | Use bundled without notification. | |

**User's choice:** Fall back and warn.

---

## Refresh Entry Point and Freshness Status

### Entry point

| Option | Description | Selected |
|--------|-------------|----------|
| App-wide schema workspace | Persistent utility opens a dedicated global workspace; tracked configs remain visible and chapters hide. | ✓ |
| Settings dialog | Put all maintenance in an application settings modal. | |
| Schema chapter | Put global maintenance beside per-config chapters. | |

**User's choice:** App-wide schema workspace.

### Persistent indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Compact source + status | Show Bundled/Refreshed, gsd-core version, and accepted/refreshed date. | ✓ |
| Date only | Show only last refreshed or never refreshed. | |
| Workspace only | No status during ordinary editing. | |

**User's choice:** Compact source + status.

### Refresh staging

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch then explicit review | Fetch a proposal, show summary/evidence, then require a separate Activate action. | ✓ |
| Single confirmation | Fetch and activate in one operation after a compact confirmation. | |
| Background proposal | Fetch automatically during ordinary use. | |

**User's choice:** Fetch then explicit review.

### No semantic changes

| Option | Description | Selected |
|--------|-------------|----------|
| Up-to-date confirmation | Show checked version/time and zero changes; update last-checked status without activation. | ✓ |
| No-op activation | Ask users to activate equivalent data. | |
| Brief toast only | Close the workspace and show a temporary message. | |

**User's choice:** Up-to-date confirmation.

---

## Claude's Discretion

- Exact workspace layout, responsive behavior, styling, icons, progress states, semantic-diff presentation, filters, evidence expansion, copy, and timestamp formatting.
- Exact additive endpoint names, app-data file format, proposal expiry, safe archive limits, retry policy, and inert parser choices, subject to the locked security and activation contracts.

## Deferred Ideas

- Scheduled/background refresh and changelog prompting.
- Prerelease/`next`, installed-version, and arbitrary-release targeting.
- Per-key or per-group merge choices and multi-version schema rollback.
- Editing curated documentation inside the app.
