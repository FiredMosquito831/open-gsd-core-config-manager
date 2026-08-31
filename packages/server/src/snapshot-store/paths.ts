/**
 * Snapshot-store path resolution (SAVE-04, D-07, D-08, D-09).
 *
 * `appDataRoot()` resolves the OS-conventional per-user app-data directory
 * via `env-paths` — Windows `%LOCALAPPDATA%`, XDG/`~/.local/share` on Linux,
 * `~/Library` on macOS. The empty `suffix` matters: env-paths otherwise
 * appends `-nodejs`, and this IS the app, not a Node library consuming it
 * (02-RESEARCH.md § Pattern 6).
 *
 * `snapshotDirFor` hashes the config's ABSOLUTE path (never the raw/relative
 * path) so relative-path variance collapses to one stable key, and takes an
 * injectable `root` parameter — mirroring `packages/config-io/src/discovery.ts`'s
 * injectable-`env` shape — so tests can redirect the store into a temp dir
 * without mocking `env-paths` (02-PATTERNS.md § snapshot-store/paths.ts).
 *
 * T-02-06 (Information Disclosure) mitigation: this module NEVER derives the
 * snapshot directory from the config file's own directory — it resolves
 * exclusively under the app-data root, so snapshots can never land inside a
 * tracked project or its `.git`.
 *
 * env-paths does NOT create directories — callers (snapshot-store/index.ts)
 * must `mkdir(dir, { recursive: true })` before writing.
 */
import envPaths from 'env-paths';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

/** Resolves the OS-conventional per-user app-data root for this app. */
export function appDataRoot(): string {
  return envPaths('open-gsd-core-config-manager', { suffix: '' }).data;
}

/**
 * Resolves the snapshot directory for a given config file:
 * `<root>/snapshots/<sha256(abs(configPath))>`.
 *
 * `root` defaults to `appDataRoot()` but is injectable so callers (and
 * tests) can redirect the entire store into an arbitrary directory —
 * never mock `env-paths` itself.
 */
export function snapshotDirFor(configPath: string, root: string = appDataRoot()): string {
  const key = createHash('sha256').update(resolve(configPath)).digest('hex');
  return join(root, 'snapshots', key);
}
