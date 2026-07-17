/**
 * App-data persisted workspace store (03-02-PLAN.md).
 *
 * Owns the user's tracked-config sidebar list: load on startup, track,
 * remove, reorder, relocate, scan, and create. The store delegates every
 * concrete filesystem path to `registry.track()` / `registry.relocate()` so
 * no client-supplied path bypasses the server's path-validation boundary.
 *
 * Persistence is intentionally minimal: only the ordered list of ids and
 * paths is stored under the OS app-data directory. Status (`ok`/`missing`/
 * `invalid`) is derived at load time so a file that disappears or becomes
 * invalid between launches is still surfaced with a problem state (D-14).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, basename, isAbsolute } from 'node:path';
import type { TrackedConfig, TrackedWorkspaceConfig } from './api-types.js';
import { createRegistry, RegistryError, type ConfigRegistry } from './registry.js';
import { saveWithSnapshot } from './snapshot-store/save-with-snapshot.js';
import { getValidator } from './schema.js';
import { appDataRoot } from './snapshot-store/paths.js';

/** Persisted workspace data shape (versioned for future migrations). */
interface PersistedWorkspace {
  version: 1;
  configs: Array<{ id: string; path: string }>;
}

interface WorkspaceStoreOptions {
  /** App-data root; defaults to the OS app-data directory. */
  appDataRoot?: string;
  /** Optional pre-existing registry (tests may inject one). */
  registry?: ConfigRegistry;
}

export interface WorkspaceStore {
  /** Ordered list of tracked workspace entries with derived status. */
  list(): TrackedWorkspaceConfig[];
  /** Validate and add a new path to the workspace and registry. */
  add(rawPath: string): TrackedWorkspaceConfig;
  /** Remove an entry from the workspace and registry. */
  remove(id: string): void;
  /** Reorder the workspace list; ids must all be known. */
  reorder(ids: string[]): void;
  /** Relocate an existing entry to a new path, keeping its id stable. */
  locate(id: string, rawPath: string): TrackedWorkspaceConfig;
  /** Scan a folder for `.planning/config.json` files; does not mutate state. */
  scan(rootPath: string): Array<{ projectName: string; path: string; status: 'new' | 'tracked' | 'invalid' }>;
  /** Preview the server-computed target path for a new config. */
  createPreview(projectDir: string): { targetPath: string; exists: boolean };
  /** Create a new config file, track it, and persist the workspace. */
  create(projectDir: string, overwrite: boolean): Promise<TrackedWorkspaceConfig>;
  /** The underlying registry used for path validation. */
  registry: ConfigRegistry;
}

function defaultAppDataRoot(): string {
  return appDataRoot();
}

function configFilePath(root: string): string {
  return join(root, 'workspace', 'configs.json');
}

function deriveStatus(path: string): Pick<TrackedWorkspaceConfig, 'status' | 'problem'> {
  try {
    const stat = statSync(path);
    if (stat.isFile()) return { status: 'ok' };
    return { status: 'invalid', problem: 'Config path is not a regular file' };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { status: 'missing', problem: 'Config file not found' };
    }
    return { status: 'invalid', problem: 'Config path cannot be read' };
  }
}

function nameFor(path: string): string {
  return `${basename(dirname(path))}/${basename(path)}`;
}

function loadPersisted(root: string): PersistedWorkspace['configs'] {
  const file = configFilePath(root);
  if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as PersistedWorkspace;
    if (data.version !== 1 || !Array.isArray(data.configs)) return [];
    return data.configs;
  } catch {
    return [];
  }
}

function savePersisted(root: string, configs: PersistedWorkspace['configs']): void {
  const file = configFilePath(root);
  mkdirSync(dirname(file), { recursive: true });
  const data: PersistedWorkspace = { version: 1, configs };
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function isExcludedDir(name: string): boolean {
  return name === 'node_modules' || name === '.git' || name === 'dist';
}

/** Create a persisted workspace store. */
export function createWorkspaceStore(opts: WorkspaceStoreOptions = {}): WorkspaceStore {
  const root = opts.appDataRoot ?? defaultAppDataRoot();
  const persisted = loadPersisted(root);
  const registry = opts.registry ?? createRegistry({ seed: persisted.map((p) => ({ id: p.id, path: p.path, name: nameFor(p.path) })) });
  const entries = new Map<string, TrackedWorkspaceConfig>();

  for (const persistedEntry of persisted) {
    const resolvedPath = resolve(persistedEntry.path);
    const tracked = registry.resolve(persistedEntry.id);
    if (!tracked || tracked.path !== resolvedPath) {
      // The registry rejected this path during seed (e.g. no longer .json).
      entries.set(persistedEntry.id, {
        id: persistedEntry.id,
        path: resolvedPath,
        name: nameFor(resolvedPath),
        status: 'invalid',
        problem: 'Config path is no longer valid',
      });
      continue;
    }

    const status = deriveStatus(resolvedPath);
    entries.set(persistedEntry.id, {
      id: persistedEntry.id,
      path: resolvedPath,
      name: nameFor(resolvedPath),
      ...status,
    });
  }

  function persist(): void {
    savePersisted(
      root,
      Array.from(entries.values()).map((e) => ({ id: e.id, path: e.path })),
    );
  }

  return {
    registry,

    list(): TrackedWorkspaceConfig[] {
      // Derive status at read time so missing files are surfaced immediately
      // without waiting for a relaunch (D-14).
      return Array.from(entries.values()).map((entry) => {
        const status = deriveStatus(entry.path);
        if (status.status === entry.status && (!status.problem || status.problem === entry.problem)) {
          return entry;
        }
        const updated: TrackedWorkspaceConfig = { ...entry, ...status };
        entries.set(entry.id, updated);
        return updated;
      });
    },

    add(rawPath: string): TrackedWorkspaceConfig {
      const tracked = registry.track(rawPath);
      const status = deriveStatus(tracked.path);
      const entry: TrackedWorkspaceConfig = { ...tracked, ...status };
      entries.set(tracked.id, entry);
      persist();
      return entry;
    },

    remove(id: string): void {
      entries.delete(id);
      registry.remove(id);
      persist();
    },

    reorder(ids: string[]): void {
      const unknownId = ids.find((id) => !entries.has(id));
      if (unknownId) {
        throw new RegistryError('Unknown tracked config id');
      }

      const ordered = new Map<string, TrackedWorkspaceConfig>();
      const remaining = new Map(entries);

      for (const id of ids) {
        const entry = remaining.get(id);
        if (entry) {
          ordered.set(id, entry);
          remaining.delete(id);
        }
      }

      for (const [id, entry] of remaining) {
        ordered.set(id, entry);
      }

      entries.clear();
      for (const [id, entry] of ordered) {
        entries.set(id, entry);
      }

      registry.reorder(ids);
      persist();
    },

    locate(id: string, rawPath: string): TrackedWorkspaceConfig {
      if (!entries.has(id)) {
        throw new RegistryError('Unknown tracked config id');
      }

      const tracked = registry.relocate(id, rawPath);
      const status = deriveStatus(tracked.path);
      const entry: TrackedWorkspaceConfig = { ...tracked, ...status };
      entries.set(id, entry);
      persist();
      return entry;
    },

    scan(rootPath: string): Array<{ projectName: string; path: string; status: 'new' | 'tracked' | 'invalid' }> {
      if (!isAbsolute(rootPath)) {
        throw new RegistryError('Scan root must be an absolute path');
      }

      const resolvedRoot = resolve(rootPath);
      const trackedPaths = new Set(registry.list().map((c) => c.path));
      const candidates: Array<{ projectName: string; path: string; status: 'new' | 'tracked' | 'invalid' }> = [];
      const stack: string[] = [resolvedRoot];

      while (stack.length > 0) {
        const dir = stack.pop()!;
        let dirEntries: string[];
        try {
          dirEntries = readdirSync(dir);
        } catch {
          continue;
        }

        const hasPlanning = dirEntries.includes('.planning');
        if (hasPlanning) {
          const planningDir = join(dir, '.planning');
          const configPath = join(planningDir, 'config.json');
          try {
            const stat = statSync(configPath);
            if (stat.isFile()) {
              if (trackedPaths.has(configPath)) {
                candidates.push({ projectName: basename(dir), path: configPath, status: 'tracked' });
              } else {
                candidates.push({ projectName: basename(dir), path: configPath, status: 'new' });
              }
            } else {
              candidates.push({ projectName: basename(dir), path: configPath, status: 'invalid' });
            }
          } catch {
            // .planning exists but config.json is missing or inaccessible.
          }
        }

        for (const entry of dirEntries) {
          if (isExcludedDir(entry)) continue;
          const fullPath = join(dir, entry);
          let stat;
          try {
            stat = statSync(fullPath);
          } catch {
            continue;
          }
          if (!stat.isDirectory()) continue;
          stack.push(fullPath);
        }
      }

      return candidates;
    },

    createPreview(projectDir: string): { targetPath: string; exists: boolean } {
      if (!isAbsolute(projectDir)) {
        throw new RegistryError('Project directory must be an absolute path');
      }
      const targetPath = resolve(projectDir, '.planning', 'config.json');
      return { targetPath, exists: existsSync(targetPath) };
    },

    async create(projectDir: string, overwrite: boolean): Promise<TrackedWorkspaceConfig> {
      if (!isAbsolute(projectDir)) {
        throw new RegistryError('Project directory must be an absolute path');
      }
      const targetPath = resolve(projectDir, '.planning', 'config.json');

      if (existsSync(targetPath) && !overwrite) {
        throw new RegistryError('Config file already exists; set overwrite to replace it');
      }

      mkdirSync(dirname(targetPath), { recursive: true });
      const minimalConfig = { mode: 'interactive' };

      const result = await saveWithSnapshot(targetPath, minimalConfig, getValidator(), { root });
      if (!result.ok) {
        // Validation should not fail for a minimal known-good config, but if
        // it does, surface it as a generic creation failure.
        throw new RegistryError('Created config failed schema validation');
      }

      const tracked = registry.track(targetPath);
      const status = deriveStatus(tracked.path);
      const entry: TrackedWorkspaceConfig = { ...tracked, ...status };
      entries.set(tracked.id, entry);
      persist();
      return entry;
    },
  };
}
