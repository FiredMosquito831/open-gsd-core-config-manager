/**
 * Global-defaults path discovery (DISC-06).
 *
 * Replicates gsd-core's own `config-loader.cjs` algorithm exactly — a
 * single fixed path relative to the home directory (or a `GSD_HOME`
 * override), never a search/probe (01-RESEARCH.md § Verified: Global
 * Defaults Discovery Algorithm):
 *
 *   const home = process.env['GSD_HOME'] || os.homedir();
 *   const globalDefaultsPath = path.join(home, '.gsd', 'defaults.json');
 *
 * `resolveGlobalDefaultsPath` accepts an injectable `env` so tests can
 * point discovery at a fixture home without mutating the real
 * `process.env` or touching the real `~/.gsd`.
 *
 * Note (01-RESEARCH.md § Finding: gsd-core's Own Runtime Only Uses Global
 * Defaults as a Bootstrap Fallback): this module only *locates and reads*
 * the file. How its result is labeled in provenance UI is a Phase 3/4
 * concern, not this module's.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Resolves the absolute path to the applicable global `defaults.json`,
 * honoring a `GSD_HOME` override exactly as gsd-core's own loader does.
 * `env` defaults to `process.env` but is injectable for testing.
 */
export function resolveGlobalDefaultsPath(env: NodeJS.ProcessEnv = process.env): string {
  const home = env['GSD_HOME'] || os.homedir();
  return path.join(home, '.gsd', 'defaults.json');
}

/**
 * Reads and parses the global defaults file at `absPath`. Never throws on
 * a missing file (`ENOENT` → `{ found: false, data: null }`); other read
 * errors are rethrown as-is. A parse failure is rethrown with the file
 * PATH only in the message — never the file body — per the Information
 * Disclosure mitigation for `readGlobalDefaults` error paths
 * (01-RESEARCH.md threat register T-01-InfoDisc-D).
 */
export function readGlobalDefaults(absPath: string): {
  found: boolean;
  data: Record<string, unknown> | null;
} {
  let raw: string;
  try {
    raw = fs.readFileSync(absPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { found: false, data: null };
    }
    throw err;
  }

  try {
    return { found: true, data: JSON.parse(raw) as Record<string, unknown> };
  } catch {
    throw new Error(`Failed to parse global defaults JSON at path: ${absPath}`);
  }
}
