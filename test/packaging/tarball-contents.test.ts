/**
 * Packaging suite (02-07-PLAN.md, DIST-03) — asserts the published npm
 * tarball's contents programmatically instead of eyeballing `npm pack
 * --dry-run`'s human-readable listing (02-VALIDATION.md's Wave 0 gap this
 * closes). Task 3 extends this file with a second `describe` block that
 * extracts and actually runs the packed tarball outside the repo.
 *
 * Every assertion here requires `dist/cli.js` and `dist/client/index.html`
 * to already exist (i.e. `npm run build` has run). `npm pack --dry-run`
 * reports whatever IS on disk, so a stale or missing `dist/` would
 * otherwise make these assertions pass or fail vacuously. `assertBuilt()`
 * throws a clear "run npm run build" message rather than silently
 * rebuilding (which would hide a broken build behind a green test).
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const CLI_ENTRY = join(REPO_ROOT, 'dist', 'cli.js');
const CLIENT_ENTRY = join(REPO_ROOT, 'dist', 'client', 'index.html');

interface PackedFile {
  path: string;
  size: number;
  mode: number;
}

interface PackResult {
  files: PackedFile[];
}

function assertBuilt(): void {
  if (!existsSync(CLI_ENTRY) || !existsSync(CLIENT_ENTRY)) {
    throw new Error(
      'test/packaging/tarball-contents.test.ts requires a fresh build first -- ' +
        'run `npm run build` (missing dist/cli.js and/or dist/client/index.html).',
    );
  }
}

/**
 * Runs a fixed, hardcoded npm command via the shell. `npm` is a `.cmd` shim
 * on Windows, which Node can only invoke through a shell — `execFileSync`
 * with an args array under `shell: true` triggers Node's DEP0190 (shell
 * concatenates unescaped array args). Passing the whole command as a single
 * string instead avoids that path entirely; every string here is a fixed
 * literal, never built from external/untrusted input.
 */
function runNpm(command: string): string {
  return execFileSync(command, { cwd: REPO_ROOT, encoding: 'utf8', shell: true });
}

function packDryRun(): PackResult {
  assertBuilt();
  const raw = runNpm('npm pack --dry-run --json');
  const parsed = JSON.parse(raw) as PackResult[];
  return parsed[0];
}

describe('tarball contents (DIST-03)', () => {
  it('contains the built CLI entry', () => {
    const result = packDryRun();
    expect(result.files.some((f) => f.path === 'dist/cli.js')).toBe(true);
  });

  it('contains the built UI', () => {
    const result = packDryRun();
    expect(result.files.some((f) => f.path === 'dist/client/index.html')).toBe(true);
  });

  it('ships no source, tests, or planning artifacts', () => {
    const result = packDryRun();
    const forbiddenPrefixes = ['packages/', 'test/', '.planning/', 'web/', 'scripts/'];
    const offenders = result.files.filter((f) => forbiddenPrefixes.some((prefix) => f.path.startsWith(prefix)));
    expect(offenders).toEqual([]);
  });

  it('the bin entry points at a file that is actually shipped', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      bin: Record<string, string>;
    };
    const binPath = pkg.bin['gsd-config-manager'].replace(/^\.\//, '');
    const result = packDryRun();
    expect(result.files.some((f) => f.path === binPath)).toBe(true);
  });
});
