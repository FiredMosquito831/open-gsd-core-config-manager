/**
 * In-memory tracked-config registry (T-02-05, T-02-25) — the SINGLE
 * path-traversal boundary in the entire API.
 *
 * `track()` is the only place in the whole server that accepts a
 * client-supplied filesystem path. Every other route resolves a client's
 * opaque `:id` through `resolve(id)` and receives a path the server itself
 * already validated and minted an id for — a client can never name a file
 * the server hasn't already accepted.
 *
 * `track()` rejects:
 *   - a non-absolute path (relative paths are ambiguous against an unknown
 *     server-side cwd and are exactly the traversal-friendly shape);
 *   - a resolved path whose basename does not end in `.json`;
 *   - a path that exists on disk but is not a regular file (e.g. a
 *     directory or a socket/symlink-to-directory).
 *
 * Every rejection throws a `RegistryError` carrying a FIXED, static message
 * — the rejected path is attacker-controlled input and is NEVER
 * interpolated into the message (T-02-25: reflecting it back would turn the
 * error channel into a filesystem-probing oracle revealing existence/type/
 * traversal-reachability).
 *
 * `id` is `sha256(resolve(path)).hex.slice(0, 32)` — the same hashing
 * scheme `snapshot-store/paths.ts` uses for its directory key (sha256 of
 * the resolved absolute path), so an id and its snapshot directory are
 * trivially correlatable in Phase 5. Tracking the same path twice returns
 * the same id and does not create a duplicate entry.
 *
 * `createRegistry()` is a factory (no module-level singleton) — persistence
 * across sessions is DISC-02, a Phase 3 requirement; keeping this a factory
 * lets Phase 3 hand it a persisted seed later without restructuring the
 * registry itself.
 */
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { statSync } from 'node:fs';
import type { TrackedConfig } from './api-types.js';

/** Thrown by `track()` on a rejected path. Message is always a fixed, static string — never the rejected path. */
export class RegistryError extends Error {}

export interface ConfigRegistry {
  /** Validates and tracks `rawPath`, returning its (possibly pre-existing) `TrackedConfig`. Throws `RegistryError` on rejection. */
  track(rawPath: string): TrackedConfig;
  /** All currently tracked configs. */
  list(): TrackedConfig[];
  /** Resolves a client-supplied opaque id to its `TrackedConfig`, or `undefined` if unknown. */
  resolve(id: string): TrackedConfig | undefined;
  /** Removes a tracked config by id. Returns `true` if it existed. */
  remove(id: string): boolean;
  /**
   * Reorders tracked configs by re-inserting them in the given id order.
   * Unknown ids are ignored; ids not mentioned are appended in their previous order.
   */
  reorder(ids: string[]): void;
  /**
   * Updates the path associated with an existing id while keeping the id stable.
   * The new path is validated the same way as `track()`; any existing entry for
   * the new path is removed so the id stays unique per path.
   */
  relocate(id: string, rawPath: string): TrackedConfig;
}

export interface CreateRegistryOptions {
  /** Pre-populate the registry with validated configs (Phase 3 persistence seed). */
  seed?: TrackedConfig[];
}

function idFor(resolvedPath: string): string {
  return createHash('sha256').update(resolvedPath).digest('hex').slice(0, 32);
}

/**
 * WR-02: `track()` validates a path's regular-file-ness only at track time.
 * Nothing re-checks that afterward — if the path is later replaced by a
 * directory (or otherwise stops being a regular file) between track time
 * and a subsequent GET/PUT, the route would previously let the resulting
 * uncaught fs error (EISDIR etc.) fall through to the generic error
 * handler (CR-01). This re-check lets the route return the SAME static
 * "Unknown tracked config id" 404 instead, without ever re-interpolating
 * the path (T-02-25).
 *
 * Returns `true` when the path does not exist yet — a not-yet-created
 * config is a legitimate state (the "create new config" PUT flow depends
 * on it) — or when it exists and is a regular file. Returns `false` only
 * when something exists at the path that is NOT a regular file.
 */
export function isRegularFileOrMissing(resolvedPath: string): boolean {
  let stat;
  try {
    stat = statSync(resolvedPath);
  } catch {
    return true;
  }
  return stat.isFile();
}

function nameFor(resolvedPath: string): string {
  return `${basename(dirname(resolvedPath))}/${basename(resolvedPath)}`;
}

function validatePath(rawPath: string): { resolvedPath: string; id: string } {
  if (!isAbsolute(rawPath)) {
    throw new RegistryError('Config path must be an absolute path');
  }

  const resolvedPath = resolve(rawPath);

  if (!basename(resolvedPath).endsWith('.json')) {
    throw new RegistryError('Config path must reference a .json file');
  }

  let stat;
  try {
    stat = statSync(resolvedPath);
  } catch {
    stat = null;
  }
  if (stat && !stat.isFile()) {
    throw new RegistryError('Config path must reference a regular file');
  }

  return { resolvedPath, id: idFor(resolvedPath) };
}

export function createRegistry(opts?: CreateRegistryOptions): ConfigRegistry {
  const byId = new Map<string, TrackedConfig>();

  if (opts?.seed) {
    for (const config of opts.seed) {
      try {
        // Re-validate persisted paths: a path that has become invalid since
        // it was tracked should not be silently accepted into the registry.
        validatePath(config.path);
      } catch {
        continue;
      }
      byId.set(config.id, config);
    }
  }

  return {
    track(rawPath: string): TrackedConfig {
      const { resolvedPath, id } = validatePath(rawPath);
      const existing = byId.get(id);
      if (existing) return existing;

      const config: TrackedConfig = { id, path: resolvedPath, name: nameFor(resolvedPath) };
      byId.set(id, config);
      return config;
    },

    list(): TrackedConfig[] {
      return Array.from(byId.values());
    },

    resolve(id: string): TrackedConfig | undefined {
      return byId.get(id);
    },

    remove(id: string): boolean {
      return byId.delete(id);
    },

    reorder(ids: string[]): void {
      const ordered = new Map<string, TrackedConfig>();
      const remaining = new Map(byId);

      for (const id of ids) {
        const config = remaining.get(id);
        if (config) {
          ordered.set(id, config);
          remaining.delete(id);
        }
      }

      for (const [id, config] of remaining) {
        ordered.set(id, config);
      }

      byId.clear();
      for (const [id, config] of ordered) {
        byId.set(id, config);
      }
    },

    relocate(id: string, rawPath: string): TrackedConfig {
      const { resolvedPath } = validatePath(rawPath);

      const existing = byId.get(id);
      if (!existing) {
        throw new RegistryError('Unknown tracked config id');
      }

      // The new path may have had its own id; remove it so the relocated id
      // is the sole owner of this path.
      const newPathId = idFor(resolvedPath);
      if (newPathId !== id) {
        byId.delete(newPathId);
      }

      const updated: TrackedConfig = { id, path: resolvedPath, name: nameFor(resolvedPath) };
      byId.set(id, updated);
      return updated;
    },
  };
}
