# Security Policy

GSD Config Manager reads and writes configuration files on your machine. It is
a local-only tool, and its security model is intentionally small enough to
audit.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x (current) | Yes |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private vulnerability reporting:
<https://github.com/FiredMosquito831/open-gsd-core-config-manager/security/advisories/new>

Include:

- the affected version (`npx open-gsd-core-config-manager --help` or
  `package.json`),
- operating system and Node.js version,
- a minimal reproduction and the observed impact.

You can expect an acknowledgement within a reasonable time. Please allow a
fix to be prepared before public disclosure.

## Security model

- **Loopback binding.** The server binds `127.0.0.1`. The host is a literal in
  the source; no flag or environment variable widens it.
- **Host allowlist.** API routes check the request `Host` header against an
  allowlist, defending against DNS rebinding.
- **Exact Origin guard.** API routes require an exact-string `Origin` match
  against the sealed launch origin.
- **No accounts or telemetry.** The application makes no analytics or
  telemetry requests.
- **One outbound path.** The user-triggered schema-update check reads
  allowlisted gsd-core release metadata. It never executes remote code; a
  proposal must be explicitly activated.
- **API keys.** Search-provider keys are written with mode `0600`, displayed
  masked, and never logged. Validation and snapshot errors never include the
  offending value.
- **File writes.** Documents are validated against the canonical schema before
  any write. Writes use a same-directory temp file, fsync and atomic rename,
  and are rejected if the on-disk revision changed.
- **Prototype pollution.** Dot-path patches reject `__proto__`, `constructor`
  and `prototype` segments.
- **Snapshot isolation.** Snapshots are stored under the OS app-data directory,
  keyed by a hash of the config path — never inside the tracked project.

## Out of scope

- Someone with local access to your user account reading your files or
  snapshots. The tool assumes the local OS account boundary.
- Vulnerabilities in `open-gsd/gsd-core` itself. Report those upstream.
- A configuration value that is valid but does something you did not intend.
  The tool explains and validates values; it cannot know your intent.
- Denial of service from deliberately hostile local files beyond the documented
  error handling.

## Data locations

See the [uninstall table](README.md#uninstalling) for where snapshots and key
files live, and how to remove them.
