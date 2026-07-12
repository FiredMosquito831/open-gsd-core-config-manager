# Phase 2: Local Loopback Server, CLI & Security Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 2-Local Loopback Server, CLI & Security Hardening
**Areas discussed:** Launch & server stack, Security model, Snapshot store, Snapshot pipeline integration

---

## Launch & server stack

### Server/CLI stack (CLAUDE.md vs research conflict)
| Option | Description | Selected |
|--------|-------------|----------|
| Fastify + Commander (locked stack) | Follow CLAUDE.md stack table exactly: Fastify 5 + Commander 15 | ✓ |
| Minimal node:http + tiny arg parser | Follow research ARCHITECTURE.md: raw node:http, hand-rolled flags | |
| Fastify + minimal args (hybrid) | Fastify server, hand-parse flags, drop Commander | |

**User's choice:** Fastify + Commander (locked stack)

### Port selection
| Option | Description | Selected |
|--------|-------------|----------|
| OS ephemeral (listen 0) | listen(0, '127.0.0.1'), read assigned port, open URL | ✓ |
| get-port preferred-with-fallback | get-port@7, stable preferred port then fallback | |

**User's choice:** OS ephemeral (listen 0)

### Teardown / single-instance
| Option | Description | Selected |
|--------|-------------|----------|
| SIGINT handler closes server + cleans locks | Signal handlers close server, release locks, exit; no single-instance | ✓ |
| Add single-instance lock too | Above + advisory lock/PID so a 2nd launch reuses the running instance | |

**User's choice:** SIGINT handler closes server + cleans locks (no single-instance lock)

---

## Security model

### Token scope
| Option | Description | Selected |
|--------|-------------|----------|
| All requests (reads + writes) | Token required on every API route; static assets unguarded | ✓ |
| Mutating requests only (literal SEC-02) | Token only on POST/PUT/DELETE; reads open on loopback | |

**User's choice:** All requests (reads + writes)

### Token flow
| Option | Description | Selected |
|--------|-------------|----------|
| URL ?t= → JS reads it → x-gsd-token header | SPA reads query param once, sends header on every fetch | ✓ |
| Token in Set-Cookie / session cookie | httpOnly cookie auto-sent; simpler client, more CSRF surface | |

**User's choice:** URL ?t= → JS reads it → x-gsd-token header

### DNS-rebinding / cross-origin defenses
| Option | Description | Selected |
|--------|-------------|----------|
| Host allowlist + Origin check both | Host-header allowlist AND Origin/Referer check via @fastify/cors | ✓ |
| Host allowlist only | Just the Host-header allowlist; lean on token for cross-origin | |

**User's choice:** Host allowlist + Origin check both

---

## Snapshot store

### Location
| Option | Description | Selected |
|--------|-------------|----------|
| OS app-data dir (env-paths style) | Per-user OS-conventional app-data dir, path-hashed per config | ✓ |
| ~/.gsd-config-manager/history | Fixed home dotdir, path-hashed subfolders | |

**User's choice:** OS app-data dir (env-paths style)

### Format
| Option | Description | Selected |
|--------|-------------|----------|
| Full-JSON snapshots + index.json | Full JSON per snapshot + index; diff/revert on-demand | ✓ |
| Diff-chain (base + deltas) | Base + per-save deltas; smaller but reconstruction/corruption risk | |

**User's choice:** Full-JSON snapshots + index.json

### Pruning-readiness
| Option | Description | Selected |
|--------|-------------|----------|
| Yes — seq + timestamp + content hash now | Bake pruning/de-dupe fields into index from day one | ✓ |
| No — minimal index, revisit later | Timestamp + filename only; migrate format later if needed | |

**User's choice:** Yes — seq + timestamp + content hash now

---

## Snapshot pipeline integration

### Hook into frozen saveConfig
| Option | Description | Selected |
|--------|-------------|----------|
| Server-layer wrapper around saveConfig | saveWithSnapshot() orchestrates read → saveConfig → record; barrel untouched | ✓ |
| Extend saveConfig with optional hook param | Add onBefore/onAfterWrite callback; mutates frozen signature | |
| New saveConfig2 in config-io | Higher-level composed function in config-io package | |

**User's choice:** Server-layer wrapper around saveConfig

### Snapshot timing
| Option | Description | Selected |
|--------|-------------|----------|
| Pre-write snapshot of current on-disk content | Snapshot existing file before overwrite; skip on brand-new file | ✓ |
| Post-write snapshot of newly saved content | Snapshot what was just written | |

**User's choice:** Pre-write snapshot of current on-disk content

### Snapshot failure handling
| Option | Description | Selected |
|--------|-------------|----------|
| Save succeeds; snapshot failure is non-fatal warning | Config write commits; history-not-recorded warning surfaced | ✓ |
| Snapshot failure fails the whole save | Treat snapshot as part of transaction; reject save if it can't record | |

**User's choice:** Save succeeds; snapshot failure is a non-fatal warning

---

## Claude's Discretion

- REST API route shape / response envelope the Phase 3 UI will call.
- Dev-vs-prod static serving (@fastify/static prod vs Vite dev proxy).
- UI-bundling mechanics for DIST-03 (bin/shebang, tsup CLI build, dist/client inclusion, npm pack verification) — placeholder served page acceptable in Phase 2.
- Exact env-paths/app-data library and path-hashing scheme.

## Deferred Ideas

- Single-instance / focus-existing-instance UX — declined for Phase 2.
- Snapshot pruning/compaction UI — index designed for it now; feature is future work.
- Version-history browse/diff/revert — Phase 5.
- Actual schema-driven UI screens — Phase 3.
