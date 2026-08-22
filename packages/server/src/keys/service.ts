/**
 * Search-provider key service — detection + read/write/clear across BOTH key
 * channels (D-14 env-var / file API-key configuration).
 *
 * A search capability's boolean toggle only takes effect when its key is
 * present, and that key can arrive via two independent channels that gsd-core's
 * own runtime loader honors:
 *
 *   env var   <PREFIX>_API_KEY            (e.g. BRAVE_API_KEY)
 *   key file  ~/.gsd/<prefix>_api_key
 *
 * The env-var channel is read from the live process environment, so a key
 * present in `process.env` is detected immediately and a key written here takes
 * effect for the current server session. The key-file channel is the durable,
 * portable one this manager controls directly. `configured` is true when EITHER
 * channel holds a non-empty key — matching gsd-core's own "either channel"
 * semantics.
 *
 * File paths are resolved with the same `GSD_HOME || homedir` + `.gsd`
 * convention the rest of this tool uses (see config-io/src/discovery.ts), so a
 * developer pointing `GSD_HOME` at a fixture home keeps every path consistent.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { KeyStatusDto } from '../api-types.js';
import { SEARCH_PROVIDERS, providerFor } from './providers.js';

function homeDir(env: NodeJS.ProcessEnv): string {
  return env['GSD_HOME'] || os.homedir();
}

function keyFilePath(provider: { fileSlug: string }, env: NodeJS.ProcessEnv): string {
  return path.join(homeDir(env), '.gsd', provider.fileSlug);
}

/** True when a string is present and non-blank. */
function isPresent(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Never throws on a missing file — returns ''. Other read errors propagate. */
function readKeyFile(absPath: string): string {
  try {
    return readFileSync(absPath, 'utf8').trim();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw err;
  }
}

export function detectKey(
  provider: { key: string; title: string; prefix: string; envVar: string; fileSlug: string; homepage?: string },
  env: NodeJS.ProcessEnv = process.env,
): KeyStatusDto {
  const fileAbsPath = keyFilePath(provider, env);
  const envConfigured = isPresent(env[provider.envVar]);
  const fileConfigured = existsSync(fileAbsPath) && isPresent(readKeyFile(fileAbsPath));
  return {
    provider: provider.key,
    title: provider.title,
    envVar: provider.envVar,
    fileSlug: provider.fileSlug,
    homepage: provider.homepage,
    configured: envConfigured || fileConfigured,
    channels: {
      envVar: { configured: envConfigured },
      file: { configured: fileConfigured, path: fileAbsPath },
    },
  };
}

export function listKeyStatuses(env: NodeJS.ProcessEnv = process.env): KeyStatusDto[] {
  return SEARCH_PROVIDERS.map((provider) => detectKey(provider, env));
}

export function getKeyStatus(providerKey: string, env: NodeJS.ProcessEnv = process.env): KeyStatusDto | undefined {
  const provider = providerFor(providerKey);
  return provider ? detectKey(provider, env) : undefined;
}

/**
 * Write or clear a single provider's key.
 *
 * `value` empty → clear (unlink file + drop env var). Otherwise write to the
 * channel(s) requested. File writes are atomic (temp + fsync + rename) and the
 * `~/.gsd` directory is created if absent. Returns the fresh detection state.
 */
export function writeKey(
  providerKey: string,
  value: string,
  channel: 'file' | 'env' | 'both',
  env: NodeJS.ProcessEnv = process.env,
): KeyStatusDto | undefined {
  const provider = providerFor(providerKey);
  if (!provider) return undefined;
  const fileAbsPath = keyFilePath(provider, env);

  const wantFile = channel === 'file' || channel === 'both';
  const wantEnv = channel === 'env' || channel === 'both';

  // Clear path (empty value) for whichever channels were requested.
  if (!isPresent(value)) {
    if (wantFile) {
      try {
        unlinkSync(fileAbsPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }
    if (wantEnv) delete env[provider.envVar];
    return detectKey(provider, env);
  }

  if (wantFile) {
    mkdirSync(path.dirname(fileAbsPath), { recursive: true });
    writeFileAtomic.sync(fileAbsPath, `${value.trim()}\n`, { mode: 0o600 });
  }
  if (wantEnv) env[provider.envVar] = value.trim();

  return detectKey(provider, env);
}

// write-file-atomic ships no type declarations. Its CJS export is the async
// writer with a `.sync` method attached (see lib/index.cjs); require it and
// cast to the single shape we use so the call site type-checks.
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const writeFileAtomic = _require('write-file-atomic') as {
  sync(path: string, data: string | Buffer, options?: { mode?: number }): void;
};
