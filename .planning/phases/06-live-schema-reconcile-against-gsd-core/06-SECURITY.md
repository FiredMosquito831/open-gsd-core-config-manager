---
phase: 6
slug: live-schema-reconcile-against-gsd-core
status: verified
threats_open: 0
asvs_level: 3
created: 2026-07-21
---

# Phase 6 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → Server API | Web client to loopback Fastify /api scope | User actions, schema data |
| Server → GitHub Release API | Fetches latest release, tag ref, and archive | Untrusted remote content |
| Server → App Data Dir | Persists schema override envelope | Activated schema state |
| Inert Parser → Source | Reads downloaded archive/registry/docs files | Untrusted downloaded content |
| Active Schema → Validator/Config | One snapshot authority drives rendering, config load/save, history | Canonical schema state |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Elevation of Privilege | Upstream Archive | critical | mitigate | Dependency-free `node:zlib` bounded reader; streaming compressed-byte cap (8 MiB) enforced during `response.body` read before `arrayBuffer`; bounded gzip output cap (32 MiB) during inflation; 4096 entry cap, 12 depth cap, 15s metadata timeout, 30s archive timeout; reject links, special files, unsafe paths, malformed PAX/GNU | closed |
| T-06-02 | Elevation of Privilege | Capability Registry Parser | critical | mitigate | TypeScript AST traversal rejects all executable constructs (function calls, spread, computed props, identifiers); only literal object/array/string/number/boolean permitted; no `eval`, `require`, or `import` | closed |
| T-06-03 | Tampering | Mutable Ref/Tag Confusion | high | mitigate | Stable-release client rejects prerelease, draft, malformed release metadata; resolves tag to immutable commit SHA before fetch; records commit prefix and archive digest for provenance | closed |
| T-06-04 | Tampering | Poisoned Override Persistence | high | mitigate | Compile-before-activate via Ajv; proposal records active-schema generation; activation rejects stale proposals; atomic single-envelope write; startup compile/validate/fallback/quarantine | closed |
| T-06-05 | Tampering | Lifecycle Race Conditions | high | mitigate | All lifecycle mutations (refresh, activate, reset, cancel) serialized through `serializeLifecycle` mutex; activation consumes proposal only after successful persistence; reset clears any retained proposal | closed |
| T-06-06 | Information Disclosure | Error Response Path Leakage | medium | mitigate | All API errors use generic `{ ok: false, errors: [{ message }] }` envelope with path-free messages; no local paths, archive internals, or raw exception text exposed | closed |
| T-06-07 | Elevation of Privilege | Local Webpage Trigger | high | mitigate | Existing per-session random token guard + Origin/Host checks on all /api routes; no unauthenticated schema endpoints | closed |
| T-06-08 | Tampering | Curated Documentation Loss | medium | mitigate | Production refresh builds authoritative curated overlays from shipped artifacts; curated descriptions never overwritten by upstream prose; documentation drift flagged not applied | closed |
| T-06-09 | Tampering | Documentation Fingerprint Ambiguity | medium | mitigate | Per-key documentation fingerprints persisted with activated schema; prose-only upstream changes produce documentation-note category, not structural change; ambiguous/missing sources fail closed | closed |
| T-06-10 | Denial of Service | Archive Extraction/Traversal | high | mitigate | No archive extraction to disk; in-memory stream inspection only; every entry header validated; duplicate required paths rejected; time/size/count caps abort and discard | closed |
| T-06-11 | Elevation of Privilege | Split Schema Generations | high | mitigate | `ActiveSchemaManager` provides one immutable compiled snapshot per request; schema rendering, validation, config load/save, and history restore all consume the same generation atomically | closed |
| T-06-12 | Tampering | Browser-Selected Repository/Ref/Path | high | mitigate | Server owns all GitHub endpoints, repository selection, commit pinning, and archive path; browser cannot supply or override any selector | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-01 | `tar@7.5.20` dependency rejected by human checkpoint (SUS legitimacy verdict); dependency-free bounded `node:zlib` reader used instead; if proven insufficient for future archive format changes, explicit escalation required | Human checkpoint | 2026-07-20 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-21 | 12 | 12 | 0 | Orchestrator direct audit (L1-L2 depth) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-21
