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
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { readdir, lstat } from 'node:fs/promises';
import { dirname, join, resolve, basename, isAbsolute } from 'node:path';

const createLocks = new Map<string, Promise<unknown>>();

async function withCreateLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = createLocks.get(key) ?? Promise.resolve();
  const run = prior.then(fn, fn);
  const chained = run.then(() => undefined, () => undefined);
  createLocks.set(key, chained);
  void chained.finally(() => {
    if (createLocks.get(key) === chained) createLocks.delete(key);
  });
  return run;
}

import type { TrackedWorkspaceConfig } from './api-types.js';
import { createRegistry, RegistryError, type ConfigRegistry } from './registry.js';
import { saveWithSnapshot } from './snapshot-store/save-with-snapshot.js';
import type { ActiveSchemaManager } from './active-schema-manager.js';
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
  /** Shared active schema authority used when creating a config. */
  activeSchemaManager?: ActiveSchemaManager;
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
  /**
   * Scan a folder for `.planning/config.json` files; does not mutate state.
   * Asynchronous so the Fastify event loop is yielded between directory
   * reads (`fs/promises.readdir` + `fs/promises.lstat`), keeping every other
   * `/api` request (schema-status, workspace/configs, health) responsive
   * while a scan is in flight instead of starving it for minutes when the
   * chosen root contains a deep nested tree (the original brick root cause).
   */
  scan(rootPath: string): Promise<{ candidates: Array<{ projectName: string; path: string; status: 'new' | 'tracked' | 'invalid' }>; truncated: boolean; scannedDirs: number }>;
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

/**
 * Top-level directory names to skip during the directory-walk scan.
 *
 * Why `.claude` and the other AI-tool tooling directories are excluded:
 * live "auto-detect" scans paste a project root that often contains a
 * `.claude/worktrees/` tree (dozens of recursive git worktrees, each ~3k+
 * dirs). Walking them synchronously blocked the single-threaded Fastify event
 * loop for minutes on a user machine — during which `/api/schema/status`,
 * `/api/workspace/configs`, and `/api/health` were starved, surfacing as the
 * "Bundled · gsd-core vschema unavailable" / "Failed to load tracked configs"
 * sidebar brick. Even after the move to `fs/promises` (so the event loop
 * yields between every directory entry) it still wastes minutes listing
 * redundant copies of THIS repo's own `.planning/config.json`, so we skip
 * these bulky developer cache / tooling dirs up-front.
 */
const EXCLUDED_DIR_NAMES: ReadonlySet<string> = new Set([
  // Build outputs / deps
  'node_modules', 'dist', 'build', 'out', 'target', '.turbo',
  // Source-control / AI tooling worktrees and caches (would clone-spray the repo)
  '.git', '.claude', '.codex', '.cursor', '.gemini', '.augment',
  '.codeium', '.windsurf', '.cline', '.trae', '.qwen', '.copilot',
  // Frontend / bundler caches
  '.next', '.nuxt', '.svelte-kit', '.parcel-cache', '.cache',
  // Python virtualenvs and bytecode caches
  '.venv', 'venv', 'env', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
  // Coverage / mutation / temp scratch
  'coverage', '.nyc_output', '.stryker-tmp', 'stryker-tmp',
  // IDE workspace state — never contains a project's `.planning`
  '.idea', '.vscode',
  // Infrastructure tooling caches
  '.terraform', '.terragrunt-cache',
]);

function isExcludedDir(name: string): boolean {
  return EXCLUDED_DIR_NAMES.has(name);
}

/**
 * Recursion caps keep pathological scans bounded even on a path that bypasses
 * the exclude list. They are generous (the median project tree is < 1k dirs)
 * but stop a single `POST /api/workspace/scan` from monopolizing the helper
 * when a user pastes a giant workspace root.
 */
const MAX_SCAN_DIRS = 5_000;
const MAX_SCAN_CANDIDATES = 200;
const MAX_SCAN_DEPTH = 8;

/** Create a persisted workspace store. */
export function createWorkspaceStore(opts: WorkspaceStoreOptions = {}): WorkspaceStore {
  const root = opts.appDataRoot ?? defaultAppDataRoot();
  const activeSchemaManager = opts.activeSchemaManager;
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

    async scan(rootPath: string): Promise<{ candidates: Array<{ projectName: string; path: string; status: 'new' | 'tracked' | 'invalid' }>; truncated: boolean; scannedDirs: number }> {
      if (!isAbsolute(rootPath)) {
        throw new RegistryError('Scan root must be an absolute path');
      }

      const resolvedRoot = resolve(rootPath);
      const trackedPaths = new Set(registry.list().map((c) => c.path));
      const candidates: Array<{ projectName: string; path: string; status: 'new' | 'tracked' | 'invalid' }> = [];
      const stack: Array<{ dir: string; depth: number }> = [{ dir: resolvedRoot, depth: 0 }];
      let scannedDirs = 0;
      let truncated = false;

      while (stack.length > 0) {
        if (scannedDirs >= MAX_SCAN_DIRS) { truncated = true; break; }
        if (candidates.length >= MAX_SCAN_CANDIDATES) { truncated = true; break; }

        const { dir, depth } = stack.pop()!;
        scannedDirs += 1;

        let dirEntries: Array<{ name: string; isDirectory: () => boolean; isSymbolicLink: () => boolean }>;
        try {
          // `fs/promises.readdir({withFileTypes})` lets the event loop yield
          // between directory reads; combined with `await lstat` below, every
          // other in-flight HTTP request gets interleaved while the scan walks.
          const entries = await readdir(dir, { withFileTypes: true });
          dirEntries = entries.map((e) => ({ name: e.name, isDirectory: () => e.isDirectory(), isSymbolicLink: () => e.isSymbolicLink() }));
        } catch {
          continue;
        }

        const entryNames = dirEntries.map((e) => e.name);
        const hasPlanning = entryNames.includes('.planning');
        if (hasPlanning) {
          const configPath = join(dir, '.planning', 'config.json');
          try {
            const configStat = await lstat(configPath);
            if (configStat.isFile()) {
              const status: 'new' | 'tracked' = trackedPaths.has(configPath) ? 'tracked' : 'new';
              candidates.push({ projectName: basename(dir), path: configPath, status });
            } else {
              candidates.push({ projectName: basename(dir), path: configPath, status: 'invalid' });
            }
          } catch {
            // .planning exists but config.json is missing or inaccessible.
          }
        }

        if (depth + 1 >= MAX_SCAN_DEPTH) {
          // At the depth cap — record what we found here and do not recurse
          // further into this dir's children (avoid runaway descents).
          continue;
        }

        for (const entry of dirEntries) {
          if (isExcludedDir(entry.name)) continue;
          const fullPath = join(dir, entry.name);
          let stat;
          try {
            stat = await lstat(fullPath);
          } catch {
            continue;
          }
          if (stat.isSymbolicLink() || !stat.isDirectory()) continue;
          stack.push({ dir: fullPath, depth: depth + 1 });
        }
      }

      return { candidates, truncated, scannedDirs };
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

      return withCreateLock(targetPath, async () => {
        if (existsSync(targetPath) && !overwrite) {
          throw new RegistryError('Config file already exists; set overwrite to replace it');
        }

        mkdirSync(dirname(targetPath), { recursive: true });
        const minimalConfig = { mode: 'interactive' };

        const validator = activeSchemaManager?.snapshot().validator;
        if (!validator) throw new RegistryError('Schema authority is unavailable');
        const result = await saveWithSnapshot(targetPath, minimalConfig, validator, { root });
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
      });
    },
  };
}
