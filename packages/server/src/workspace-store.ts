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
 *
 * File watching (D-14, chokidar): watches tracked config files for external
 * changes and notifies subscribers so the UI can show "file changed on disk"
 * and offer reload, avoiding silently overwriting external edits.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { open, readdir, lstat, mkdir } from 'node:fs/promises';
import { lock } from 'proper-lockfile';
import { writeWithRetry } from '../../config-io/src/atomic-write.js';
import { dirname, join, resolve, basename, isAbsolute } from 'node:path';
import chokidar, { FSWatcher } from 'chokidar';
import { installWatchErrorHandler } from './watch-error-guard.js';

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

/** File change event for tracked configs. */
export interface ConfigFileChangeEvent {
  type: 'changed' | 'deleted' | 'renamed';
  configId: string;
  path: string;
  timestamp: Date;
}

/** Subscriber callback for config file changes. */
export type ConfigFileChangeSubscriber = (event: ConfigFileChangeEvent) => void;

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
  /** Test seam for simulating an atomic persistence failure. */
  write?: typeof writeWithRetry;
}

/** A static, path-free recovery warning safe to return from the list endpoint. */
export const WORKSPACE_METADATA_RECOVERY_WARNING = 'Workspace metadata was invalid and has been reset.';

/** Persistence failures are intentionally converted into a static route error. */
export class WorkspacePersistenceError extends Error {
  constructor() {
    super('Unable to save workspace changes');
  }
}

export interface WorkspaceStore {
  /** Ordered list of tracked workspace entries with derived status and recovery warning. */
  list(): { configs: TrackedWorkspaceConfig[]; warning?: string };
  /** Validate and add a new path to the workspace and registry. */
  add(rawPath: string): Promise<TrackedWorkspaceConfig>;
  /** Remove an entry from the workspace and registry. */
  remove(id: string): Promise<void>;
  /** Reorder the workspace list; ids must all be known. */
  reorder(ids: string[]): Promise<void>;
  /** Relocate an existing entry to a new path, keeping its id stable. */
  locate(id: string, rawPath: string): Promise<TrackedWorkspaceConfig>;
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
  /** Subscribe to config file changes detected by the file watcher. */
  subscribe(subscriber: ConfigFileChangeSubscriber): () => void;
  /** Start watching all tracked config files. */
  startWatching(): void;
  /** Stop watching all config files. */
  stopWatching(): void;
  /** Watch a specific config file for changes (internal use). */
  watchConfig(config: TrackedWorkspaceConfig): void;
  /** Stop watching a specific config file (internal use). */
  unwatchConfig(configId: string): void;
  /** The underlying registry used for path validation. */
  registry: ConfigRegistry;
  /** Internal: event subscribers for file changes. */
  subscribers: Set<ConfigFileChangeSubscriber>;
  /** Internal: chokidar file watcher instance. */
  watcher: FSWatcher | null;
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

function isPersistedEntry(value: unknown): value is PersistedWorkspace['configs'][number] {
  if (!value || typeof value !== 'object') return false;
  const entry = value as { id?: unknown; path?: unknown };
  if (typeof entry.id !== 'string' || typeof entry.path !== 'string' || !isAbsolute(entry.path)) return false;
  try {
    const validated = createRegistry().track(entry.path);
    return validated.id === entry.id;
  } catch {
    return false;
  }
}

function parsePersisted(file: string): PersistedWorkspace['configs'] {
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!data || typeof data !== 'object') throw new Error('Invalid workspace metadata');
  const workspace = data as { version?: unknown; configs?: unknown };
  if (workspace.version !== 1 || !Array.isArray(workspace.configs) || !workspace.configs.every(isPersistedEntry)) {
    throw new Error('Invalid workspace metadata');
  }
  return workspace.configs;
}

function quarantineMalformed(file: string): void {
  for (let attempt = 0; attempt < 100; attempt++) {
    const suffix = `${Date.now()}-${process.pid}-${attempt}`;
    const quarantine = `${file}.corrupt-${suffix}`;
    if (existsSync(quarantine)) continue;
    try {
      renameSync(file, quarantine);
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw err;
    }
  }
  throw new Error('Unable to quarantine workspace metadata');
}

function loadPersisted(root: string): { configs: PersistedWorkspace['configs']; warning?: string } {
  const file = configFilePath(root);
  if (!existsSync(file)) return { configs: [] };
  try {
    return { configs: parsePersisted(file) };
  } catch {
    // Keep the original bytes available for recovery rather than silently
    // replacing malformed metadata with an empty workspace.
    quarantineMalformed(file);
    return { configs: [], warning: WORKSPACE_METADATA_RECOVERY_WARNING };
  }
}

async function withWorkspaceLock<T>(root: string, fn: () => Promise<T>): Promise<T> {
  const file = configFilePath(root);
  const lockTarget = `${file}.guard`;
  await mkdir(dirname(file), { recursive: true });
  const handle = await open(lockTarget, 'a');
  await handle.close();
  const release = await lock(lockTarget, { retries: { retries: 10, factor: 1.3 }, stale: 10_000 });
  try {
    return await fn();
  } finally {
    await release();
  }
}

function savePersisted(root: string, configs: PersistedWorkspace['configs'], write: typeof writeWithRetry): Promise<void> {
  const file = configFilePath(root);
  const data: PersistedWorkspace = { version: 1, configs };
  return write(file, JSON.stringify(data, null, 2));
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
  const atomicWrite = opts.write ?? writeWithRetry;
  const loaded = loadPersisted(root);
  const registry = opts.registry ?? createRegistry({ seed: loaded.configs.map((p) => ({ id: p.id, path: p.path, name: nameFor(p.path) })) });
  let recoveryWarning = loaded.warning;
  let entries = entriesFor(loaded.configs);

  function entriesFor(configs: PersistedWorkspace['configs']): Map<string, TrackedWorkspaceConfig> {
    return new Map(configs.map((entry) => {
      const path = resolve(entry.path);
      return [entry.id, { id: entry.id, path, name: nameFor(path), ...deriveStatus(path) }];
    }));
  }

  function syncRegistry(configs: PersistedWorkspace['configs']): void {
    for (const config of registry.list()) registry.remove(config.id);
    for (const config of configs) registry.track(config.path);
    registry.reorder(configs.map((config) => config.id));
  }

  async function mutate(
    transform: (configs: PersistedWorkspace['configs'], candidateRegistry: ConfigRegistry) => PersistedWorkspace['configs'],
  ): Promise<void> {
    try {
      const saved = await withWorkspaceLock(root, async () => {
        // Re-read while holding the lock so independently-created stores never
        // write a stale in-memory list over another store's change.
        const file = configFilePath(root);
        const current = existsSync(file) ? parsePersisted(file) : [];
        const candidateRegistry = createRegistry({ seed: current.map((p) => ({ id: p.id, path: p.path, name: nameFor(p.path) })) });
        const next = transform(current, candidateRegistry);
        await savePersisted(root, next, atomicWrite);
        return next;
      });
      // Do not change observable in-memory state until the durable write succeeds.
      syncRegistry(saved);
      entries = entriesFor(saved);
    } catch (err) {
      if (err instanceof RegistryError) throw err;
      throw new WorkspacePersistenceError();
    }
  }

  return {
    registry,

    list() {
      // Derive status at read time so missing files are surfaced immediately
      // without waiting for a relaunch (D-14).
      const configs = Array.from(entries.values()).map((entry) => {
        const status = deriveStatus(entry.path);
        if (status.status === entry.status && (!status.problem || status.problem === entry.problem)) return entry;
        const updated: TrackedWorkspaceConfig = { ...entry, ...status };
        entries.set(entry.id, updated);
        return updated;
      });
      return { configs, ...(recoveryWarning ? { warning: recoveryWarning } : {}) };
    },

    async add(rawPath: string): Promise<TrackedWorkspaceConfig> {
      let result: TrackedWorkspaceConfig | undefined;
      await mutate((configs, candidateRegistry) => {
        const tracked = candidateRegistry.track(rawPath);
        result = { ...tracked, ...deriveStatus(tracked.path) };
        return candidateRegistry.list().map(({ id, path }) => ({ id, path }));
      });
      this.watchConfig(result!);
      return result!;
    },

    async remove(id: string): Promise<void> {
      this.unwatchConfig(id);
      await mutate((configs, candidateRegistry) => {
        candidateRegistry.remove(id);
        return candidateRegistry.list().map(({ id: configId, path }) => ({ id: configId, path }));
      });
    },

    async reorder(ids: string[]): Promise<void> {
      await mutate((configs, candidateRegistry) => {
        if (ids.some((id) => !candidateRegistry.resolve(id))) throw new RegistryError('Unknown tracked config id');
        candidateRegistry.reorder(ids);
        return candidateRegistry.list().map(({ id, path }) => ({ id, path }));
      });
    },

    async locate(id: string, rawPath: string): Promise<TrackedWorkspaceConfig> {
      let result: TrackedWorkspaceConfig | undefined;
      await mutate((configs, candidateRegistry) => {
        const tracked = candidateRegistry.relocate(id, rawPath);
        result = { ...tracked, ...deriveStatus(tracked.path) };
        return candidateRegistry.list().map(({ id: configId, path }) => ({ id: configId, path }));
      });
      // Unwatch old path, watch new path
      this.unwatchConfig(id);
      this.watchConfig(result!);
      return result!;
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

        let entry: TrackedWorkspaceConfig | undefined;
        await mutate((configs, candidateRegistry) => {
          const tracked = candidateRegistry.track(targetPath);
          entry = { ...tracked, ...deriveStatus(tracked.path) };
          return candidateRegistry.list().map(({ id, path }) => ({ id, path }));
        });
        // Start watching the new config
        this.watchConfig(entry!);
        return entry!;
      });
    },

    // File watching implementation
    subscribers: new Set<ConfigFileChangeSubscriber>(),
    watcher: null as FSWatcher | null,

    subscribe(subscriber: ConfigFileChangeSubscriber): () => void {
      this.subscribers.add(subscriber);
      return () => this.subscribers.delete(subscriber);
    },

    startWatching(): void {
      if (this.watcher) return;
      // A path the OS denies a watch on (e.g. EPERM on Windows without
      // Developer Mode) is thrown natively inside libuv's fs.watch callback —
      // below chokidar's layer — so it can only be caught process-wide. Install
      // the guard exactly where the watcher is created; it is idempotent, so the
      // repeated calls bootstrap/app make are harmless. See watch-error-guard.ts.
      installWatchErrorHandler();
      this.watcher = chokidar.watch([], {
        persistent: false,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
        // Suppress permission-denied errors (e.g. EPERM on Windows paths the
        // process cannot watch). The watcher is a best-effort change channel —
        // tracked-config status is derived on load and on every event — so a
        // path that can't be watched must never crash the server. Defense-in-
        // depth: any non-permission watcher error still routes to the 'error'
        // handler below and is logged without throwing.
        ignorePermissionErrors: true,
      });
      this.watcher.on('all', (event: string, path: string) => {
        const normalizedPath = resolve(path);
        const config = Array.from(entries.values()).find((e) => e.path === normalizedPath);
        if (config) {
          const changeEvent: ConfigFileChangeEvent = {
            type: event === 'change' ? 'changed' : event === 'unlink' ? 'deleted' : 'renamed',
            configId: config.id,
            path: normalizedPath,
            timestamp: new Date(),
          };
          this.subscribers.forEach((sub: ConfigFileChangeSubscriber) => sub(changeEvent));
          // Update derived status
          const status = deriveStatus(normalizedPath);
          entries.set(config.id, { ...config, ...status });
        }
      });
      // The watcher is a best-effort change-notification channel: a watch can
      // fail (e.g. EPERM on Windows for a permission-denied path) without the
      // tracked-config surface being broken — status is derived on load and on
      // each event. Never let a watcher error crash the process.
      this.watcher.on('error', (error: unknown) => {
        console.error('[workspace-store] config file watcher error:', error);
      });
      // Watch all currently tracked configs
      for (const entry of entries.values()) {
        this.watcher.add(entry.path);
      }
    },

    stopWatching(): void {
      if (this.watcher) {
        this.watcher.close().catch(() => {
          // Ignore close errors
        });
        this.watcher = null;
      }
    },

    // Local watcher helper functions (closure over `entries` and `watcher`)
    watchConfig(config: TrackedWorkspaceConfig): void {
      if (this.watcher) {
        this.watcher.add(config.path);
      }
    },

    unwatchConfig(configId: string): void {
      const config = entries.get(configId);
      if (config && this.watcher) {
        this.watcher.unwatch(config.path);
      }
    },
  };
}
