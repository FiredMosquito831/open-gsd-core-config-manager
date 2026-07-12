/**
 * Snapshot-store index — full-JSON snapshots + a seq/timestamp/contentHash
 * `index.json` per tracked config (SAVE-04, D-08, D-09, 02-RESEARCH.md
 * § Pattern 6).
 *
 * D-08: one full JSON file per snapshot (KB-scale configs — cheap), never a
 * diff-chain, to avoid reconstruction/chain-corruption risk on a
 * data-safety-critical tool. Diff/revert is computed on-demand by Phase 5.
 *
 * D-09: every index entry carries `seq` + `timestamp` + `contentHash` from
 * day one, so keep-last-N / keep-milestones pruning and skip-identical-save
 * de-dupe can be added later WITHOUT an on-disk format migration.
 *
 * T-02-13 (Tampering/DoS) mitigation: `readIndex` returns an empty index
 * only on ENOENT (a normal first-run state) — a malformed/unparseable
 * `index.json` THROWS rather than silently resetting history, because a
 * `recordSnapshot` throw is non-fatal (D-12) and degrades to a "history not
 * recorded" warning instead of silently destroying prior snapshots.
 *
 * T-02-12 (Information Disclosure) mitigation: mirrors `ValidationError` in
 * `packages/config-io/src/atomic-write.ts` — no function here ever logs or
 * throws with the snapshotted config CONTENT in an error message.
 *
 * T-02-15 (Elevation of Privilege) mitigation: the parsed index is only ever
 * read for its `entries` array and each entry's numeric `seq` — no key from
 * a parsed `index.json` is ever used as an assignment target or spread onto
 * an object literal (no prototype-pollution surface).
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { snapshotDirFor } from './paths.js';

/** One entry in a config's snapshot `index.json` (D-09). */
export interface SnapshotIndexEntry {
  /** Monotonic per-config sequence number, starting at 1. */
  seq: number;
  /** ISO-8601 timestamp of when the snapshot was recorded. */
  timestamp: string;
  /** sha256 hex digest of the snapshotted content — enables future de-dupe. */
  contentHash: string;
  /** Relative filename of the full-JSON snapshot, e.g. "3.json". */
  file: string;
}

/** The full on-disk `index.json` shape for one tracked config. */
export interface SnapshotIndex {
  entries: SnapshotIndexEntry[];
}

/**
 * Reads `<dir>/index.json`. Returns `{ entries: [] }` when the directory or
 * file does not exist yet (ENOENT is a normal first-run state, not an
 * error). A malformed/unparseable `index.json` THROWS rather than silently
 * resetting history (T-02-13) — losing history silently is the exact
 * failure mode this feature exists to prevent.
 */
export async function readIndex(dir: string): Promise<SnapshotIndex> {
  let raw: string;
  try {
    raw = await readFile(join(dir, 'index.json'), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { entries: [] };
    }
    throw err;
  }

  try {
    const parsed = JSON.parse(raw) as SnapshotIndex;
    return { entries: parsed.entries };
  } catch {
    throw new Error(`Failed to parse snapshot index at path: ${join(dir, 'index.json')}`);
  }
}

/**
 * Records a full-JSON snapshot of `priorContent` for `configPath`, appending
 * a new entry to that config's `index.json`.
 *
 * Returns `undefined` immediately when `priorContent` is `null` (D-11: a
 * brand-new file has nothing to snapshot — no directory is created, no
 * phantom index entry is written).
 *
 * Otherwise: resolves the snapshot dir, creates it (`mkdir` recursive),
 * reads the existing index, computes the next `seq` (last entry's `seq + 1`,
 * starting at 1) and the `contentHash` (sha256 of `priorContent`), writes
 * the full prior content verbatim to `<seq>.json` (D-08 — never a diff),
 * appends the new entry, rewrites `index.json` pretty-printed (2-space
 * indent), and returns a snapshot id of the form `<dirBasename>:<seq>`.
 */
export async function recordSnapshot(
  configPath: string,
  priorContent: string | null,
  root?: string,
): Promise<string | undefined> {
  if (priorContent === null) return undefined; // D-11

  const dir = snapshotDirFor(configPath, root);
  await mkdir(dir, { recursive: true });

  const index = await readIndex(dir);
  const seq = (index.entries.at(-1)?.seq ?? 0) + 1;
  const contentHash = createHash('sha256').update(priorContent).digest('hex');
  const file = `${seq}.json`;

  await writeFile(join(dir, file), priorContent, 'utf8');

  index.entries.push({ seq, timestamp: new Date().toISOString(), contentHash, file });
  await writeFile(join(dir, 'index.json'), JSON.stringify(index, null, 2), 'utf8');

  const dirParts = dir.split(/[\\/]/);
  const dirBasename = dirParts[dirParts.length - 1];
  return `${dirBasename}:${seq}`;
}

/**
 * Returns the recorded snapshot history for `configPath` (empty array when
 * nothing has been recorded yet). Phase 2 needs this for verification only
 * — Phase 5 (SAVE-05) exposes it over HTTP; no HTTP route is added here.
 */
export async function listSnapshots(configPath: string, root?: string): Promise<SnapshotIndexEntry[]> {
  const dir = snapshotDirFor(configPath, root);
  const index = await readIndex(dir);
  return index.entries;
}
