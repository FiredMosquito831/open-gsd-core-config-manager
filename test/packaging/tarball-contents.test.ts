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
import { describe, expect, it, afterEach } from 'vitest';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { terminateProcessTree } from '../helpers/process-tree.js';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const CLI_ENTRY = join(REPO_ROOT, 'dist', 'cli.js');
const CLIENT_ENTRY = join(REPO_ROOT, 'dist', 'client', 'index.html');
const REPO_NODE_MODULES = join(REPO_ROOT, 'node_modules');

/** Matches 02-UI-SPEC.md's frozen launch-banner URL shape. */
const BANNER_URL_PATTERN =
  /http:\/\/127\.0\.0\.1:(\d+)\/\?t=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

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

  it('contains the built Vite UI shell and assets', () => {
    const result = packDryRun();
    expect(result.files.some((f) => f.path === 'dist/client/index.html')).toBe(true);
    expect(result.files.some((f) => /^dist\/client\/assets\/index-.*\.js$/.test(f.path))).toBe(true);
    expect(result.files.some((f) => /^dist\/client\/assets\/index-.*\.css$/.test(f.path))).toBe(true);

    const builtHtml = readFileSync(CLIENT_ENTRY, 'utf8');
    expect(builtHtml).toContain('/assets/');
    expect(builtHtml).not.toMatch(/placeholder/i);
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

/**
 * Task 3: extracts the real packed tarball outside the repo and runs it.
 * `npm pack --dry-run` only proves a file is on disk; it proves nothing
 * about whether the bundle resolves at runtime. This is the only check
 * that catches a missing inlined source or an unresolvable schema import,
 * both invisible from inside the repo where every relative path happens to
 * already work (02-RESEARCH.md Pitfall 4).
 */
describe('extracted-tarball smoke run (DIST-01, DIST-03, DIST-04)', () => {
  let tmpRoot: string | undefined;
  let child: ChildProcess | undefined;
  let nodeModulesLink: string | undefined;

  afterEach(async () => {
    if (child) {
      await terminateProcessTree(child);
    }
    child = undefined;

    // Remove the node_modules symlink BEFORE the recursive delete, so
    // cleanup can never walk into (and mutate/delete through) the repo's
    // real node_modules.
    if (nodeModulesLink) {
      try {
        unlinkSync(nodeModulesLink);
      } catch {
        // already gone / never created -- fine
      }
      nodeModulesLink = undefined;
    }
    if (tmpRoot) {
      rmSync(tmpRoot, { recursive: true, force: true });
      tmpRoot = undefined;
    }
  });

  it(
    'the packed tarball runs from a clean extraction',
    async () => {
      assertBuilt();

      // 1. Pack a real tarball into a fresh directory under os.tmpdir(),
      // outside the repo -- resolving from inside the repo would let Node
      // walk up and find the repo's own node_modules, hiding exactly the
      // bug this test hunts.
      tmpRoot = mkdtempSync(join(tmpdir(), 'gsdcm-pack-'));
      const packOut = execFileSync(`npm pack --pack-destination "${tmpRoot}" --json`, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        shell: true,
      });
      const [{ filename }] = JSON.parse(packOut) as Array<{ filename: string }>;
      const tarballPath = join(tmpRoot, filename);

      // 2. Extract it, yielding <tmpRoot>/extracted/package/.
      // Two Windows-only quirks: `--force-local` stops GNU tar's `host:path`
      // remote-archive syntax from misparsing a `C:\...` drive-letter path
      // as a remote host named `C`; forward slashes avoid a separate
      // backslash-escaping misparse this environment's tar exhibits with
      // native Windows-style paths.
      const extractDir = join(tmpRoot, 'extracted');
      mkdirSync(extractDir, { recursive: true });
      const toPosix = (p: string): string => p.replace(/\\/g, '/');
      execFileSync(
        'tar',
        ['--force-local', '-xzf', toPosix(tarballPath), '-C', toPosix(extractDir)],
        { encoding: 'utf8' },
      );
      const packageDir = join(extractDir, 'package');

      // 3. Make the real npm dependencies resolvable without a network
      // install: symlink (junction -- works on Windows without elevation)
      // the repo's node_modules into the extracted package dir. Anything
      // the bundle needs that is NOT a declared dependency -- e.g. a
      // packages/** source that failed to inline -- still fails to
      // resolve here, which is exactly the signal this test hunts.
      nodeModulesLink = join(packageDir, 'node_modules');
      symlinkSync(REPO_NODE_MODULES, nodeModulesLink, 'junction');

      // 4. Spawn the extracted CLI directly -- never the repo's dist/cli.js.
      // The trailing 'ipc' channel is the same additive, production-shipped
      // affordance `bootstrap.ts`'s `registerSignalHandlers()` already
      // accepts (see its Windows-fallback comment, established in
      // 02-06-SUMMARY.md): on this Windows sandbox, `child_process.kill()`
      // performs an unconditional `TerminateProcess` for every signal name
      // and never reaches the child's own `process.on('SIGINT', ...)`
      // handler (no attached Win32 console exists anywhere in this
      // git-bash-hosted process tree to deliver a real console-control
      // event). A real `npx gsd-config-manager` launch from a shell never
      // gets an IPC channel, so this is purely a test-harness affordance —
      // it exercises the identical awaited-close/ordering/port-release
      // production code path, just triggered via the documented equivalent
      // path rather than a genuine OS signal (which step 4 of the Task 4
      // human checkpoint is the designated ground-truth check for).
      const builtCliPath = join(packageDir, 'dist', 'cli.js');
      child = spawn(process.execPath, [builtCliPath, '--no-open'], {
        cwd: packageDir,
        env: { ...process.env, NO_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        detached: process.platform !== 'win32',
      });

      let stdoutBuf = '';
      let stderrBuf = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString('utf8');
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString('utf8');
      });

      // 5. Wait for the banner, parse port + token from it.
      const { port, token } = await new Promise<{ port: number; token: string }>((res, rej) => {
        const timer = setTimeout(() => {
          void terminateProcessTree(child!);
          rej(new Error(`smoke run: timed out waiting for launch banner. stderr:\n${stderrBuf}`));
        }, 20_000);

        function onData(chunk: Buffer) {
          const match = BANNER_URL_PATTERN.exec(stdoutBuf + chunk.toString('utf8'));
          if (match) {
            clearTimeout(timer);
            child?.stdout?.off('data', onData);
            res({ port: Number(match[1]), token: match[2] });
          }
        }
        child?.stdout?.on('data', onData);
        child?.on('exit', (code) => {
          clearTimeout(timer);
          rej(new Error(`smoke run: process exited before printing a launch banner (code=${code}). stderr:\n${stderrBuf}`));
        });
      });

      // 6. GET / with no token -- proves dist/client shipped AND is served
      // from the extracted location, not from the repo.
      const rootRes = await fetch(`http://127.0.0.1:${port}/`);
      expect(rootRes.status).toBe(200);
      const rootBody = await rootRes.text();
      const expectedHtml = readFileSync(join(packageDir, 'dist', 'client', 'index.html'), 'utf8');
      expect(rootBody).toBe(expectedHtml);

      // 7. GET /api/health with the x-gsd-token header -- proves the
      // guarded API works in the shipped artifact.
      const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`, {
        headers: { 'x-gsd-token': token },
      });
      expect(healthRes.status).toBe(200);
      const healthBody = (await healthRes.json()) as { ok: boolean; version?: string };
      expect(healthBody.ok).toBe(true);
      // WR-01 regression guard: readPackageVersion()'s old __dirname-walk
      // landmine only breaks in the BUNDLED artifact (this exact extracted,
      // outside-the-repo run) — it always "worked" from source, which is why
      // this assertion has to live in the extracted-tarball smoke run and
      // not merely in an in-repo unit test. Must match the real
      // package.json's version, never the "walk failed, fell back" sentinel.
      const rootPkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { version: string };
      expect(healthBody.version).toBe(rootPkg.version);
      expect(healthBody.version).not.toBe('0.0.0');

      // 8. SIGINT-equivalent (see the spawn comment above) -- assert clean
      // exit and the ordered shutdown copy.
      child.send?.('SIGINT');
      const exitCode = await new Promise<number | null>((res) => {
        child?.on('exit', (code) => res(code));
      });
      expect(exitCode).toBe(0);
      expect(stdoutBuf).toContain('Shutting down');
      expect(stdoutBuf).toContain('Server stopped. Port released, no changes lost.');
    },
    30_000,
  );
});
