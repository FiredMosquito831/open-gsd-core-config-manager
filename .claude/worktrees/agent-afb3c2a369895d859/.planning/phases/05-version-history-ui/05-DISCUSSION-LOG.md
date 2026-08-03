# Phase 5: Version History UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 5-Version History UI
**Areas discussed:** History workspace, Snapshot timeline, Structural diff, Safe revert flow

---

## History workspace

### Entry point
| Option | Description | Selected |
|---|---|---|
| Dedicated workspace | Switch the main area into config-specific History, preserving the tracked-config sidebar and a clear Back action. | ✓ |
| Middle-nav chapter | Place History beside schema-derived chapters. | |
| Right-side drawer | Overlay history beside the editor with constrained diff space. | |
| You decide | Leave the entry point to planning. | |

### Layout
| Option | Description | Selected |
|---|---|---|
| List + diff split | Keep snapshot selection visible beside the comparison. | ✓ |
| List then detail | Navigate from a full-width list to a separate diff view. | |
| Timeline above diff | Use a horizontal visual timeline. | |
| You decide | Leave layout to planning. | |

### Visible shell
| Option | Description | Selected |
|---|---|---|
| Config sidebar only | Preserve tracked configs; replace chapters and editor with History. | ✓ |
| Both navigation panes | Preserve config and chapter navigation. | |
| History full screen | Hide both navigation panes. | |
| You decide | Leave pane visibility to planning. | |

### Unsaved draft on entry
| Option | Description | Selected |
|---|---|---|
| Preserve draft, compare disk | Keep the draft in memory while explicitly comparing snapshots to the saved file. | ✓ |
| Block until resolved | Require save/discard before entering History. | |
| Compare with draft | Compare snapshots against pending edits. | |
| You decide | Leave draft handling to planning. | |

**User's choice:** Dedicated workspace with list/diff split, config sidebar retained, and unsaved drafts preserved while comparison remains disk-based.
**Notes:** The focused-workspace pattern already exists; schema chapter navigation has no role in History.

---

## Snapshot timeline

### Ordering
| Option | Description | Selected |
|---|---|---|
| Newest first | Put likely recovery targets first. | ✓ |
| Oldest first | Read evolution chronologically. | |
| User toggle | Allow both sort directions. | |
| You decide | Leave ordering to planning. | |

### Row content
| Option | Description | Selected |
|---|---|---|
| Time + change count | Show relative/exact time, sequence, and changed-key count. | ✓ |
| Timestamp only | Show recorded metadata only. | |
| Time + changed keys | Preview key paths in every row. | |
| You decide | Let planning balance density and computation. | |

### Long-history organization
| Option | Description | Selected |
|---|---|---|
| Date groups | Group by Today, Yesterday, and calendar dates. | ✓ |
| Continuous list | Render one uninterrupted chronological list. | |
| Calendar picker | Select a date before seeing snapshots. | |
| You decide | Leave grouping to planning. | |

### Empty state
| Option | Description | Selected |
|---|---|---|
| Explain first save | Explain when history begins without inventing a version. | ✓ |
| Show current as version | Create a synthetic current entry. | |
| Minimal empty list | Show only “No history yet.” | |
| You decide | Leave treatment to planning. | |

**User's choice:** Newest-first, date-grouped list with time, sequence, and changed-key count; explanatory empty state.
**Notes:** The snapshot store does not record actors or messages, so the UI must not invent them.

---

## Structural diff

### Default hierarchy
| Option | Description | Selected |
|---|---|---|
| Summary + full diff | Provide orientation and exhaustive structural detail. | ✓ |
| Full diff only | Start directly with the complete object diff. | |
| Summary only | Use friendly changed-key cards without a full tree. | |
| You decide | Leave hierarchy to planning. | |

### Direction
| Option | Description | Selected |
|---|---|---|
| Snapshot → Current | Describe how the config evolved since the selected past state. | ✓ |
| Current → Snapshot | Orient around the pending restoration. | |
| Toggle direction | Allow direction changes. | |
| You decide | Leave one stable direction to planning. | |

### Unchanged content
| Option | Description | Selected |
|---|---|---|
| Collapse unchanged | Keep context available while prioritizing changed branches. | ✓ |
| Hide unchanged | Render only changed nodes. | |
| Show everything | Expand both complete objects. | |
| You decide | Leave defaults to the component. | |

### Scalar values
| Option | Description | Selected |
|---|---|---|
| Inline before/after | Show readable old → current rows with expanded blocks for complex values. | ✓ |
| Always side by side | Use snapshot/current columns for every change. | |
| Patch notation | Render add/remove/replace operations. | |
| You decide | Adapt by shape without a locked format. | |

**User's choice:** Summary plus full expandable Snapshot → Current diff, with unchanged branches collapsed and short changes inline.
**Notes:** Color is secondary to explicit labels, and existing sensitive-field masking must apply throughout History.

---

## Safe revert flow

### Confirmation
| Option | Description | Selected |
|---|---|---|
| Review confirmation | Name the config/snapshot, summarize changes, and explain the automatic undo snapshot. | ✓ |
| Immediate restore + undo | Write first, then offer undo. | |
| Type to confirm | Require typing the config name. | |
| You decide | Leave confirmation strength to planning. | |

### Unsaved draft at restore
| Option | Description | Selected |
|---|---|---|
| Require draft decision | Save first, discard and restore, or cancel. | ✓ |
| Discard automatically | Clear unsaved work without a separate decision. | |
| Keep draft after restore | Retain a stale draft over restored disk state. | |
| You decide | Leave a no-data-loss flow to planning. | |

### Successful destination
| Option | Description | Selected |
|---|---|---|
| Return to editor | Reload the restored config and show persistent success feedback. | ✓ |
| Stay in History | Refresh the comparison in place. | |
| Ask each time | Prompt for the destination after completion. | |
| You decide | Leave destination to planning. | |

### Failure behavior
| Option | Description | Selected |
|---|---|---|
| Stay with actionable error | Preserve context and explain whether the config changed. | ✓ |
| Generic failure toast | Show brief undifferentiated failure feedback. | |
| Return to editor | Exit History after failure. | |
| You decide | Leave details to planning. | |

**User's choice:** Deliberate review confirmation, explicit draft resolution, return to reloaded editor on success, and contextual errors in History on failure.
**Notes:** Restore must reuse `saveWithSnapshot()`; history-recording warnings remain non-blocking exactly as with normal saves.

---

## Claude's Discretion

- Exact visual tokens, widths, breakpoints, icons, animations, timestamp formatting, loading states, diff dependency, caching strategy, endpoint names, query keys, and minor copy.
- These choices must preserve all locked behavior in `05-CONTEXT.md`.

## Deferred Ideas

- Snapshot naming/notes/actors and manually created milestones.
- Pruning, retention, quota, deletion, and de-duplication UI.
- History search/filtering, snapshot-to-snapshot comparison, and per-field restore.
- Cloud sync, collaboration, and git integration.
