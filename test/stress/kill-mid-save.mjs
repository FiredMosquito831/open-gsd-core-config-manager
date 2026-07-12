#!/usr/bin/env node
/**
 * Standalone kill-mid-save atomicity stress harness (SAVE-02, success
 * criterion #4).
 *
 * This is the Windows phase-gate harness referenced by 01-VALIDATION.md
 * § Manual-Only Verifications — run it on the real Windows target before
 * the phase gate and confirm every kill leaves `config.json` fully
 * old-or-new content. It is intentionally a plain `.mjs` script, NOT a
 * `*.test.ts` file, so it is never collected by the default `vitest run`
 * (see vitest.config.ts `test.include: ['test/**\/*.test.ts']`).
 *
 * Usage:
 *   node test/stress/kill-mid-save.mjs [iterations]
 *   (default iterations: 20)
 *
 * What it does, per iteration:
 *   1. Seed a temp target file with a known-good "old" JSON payload.
 *   2. Spawn a child process (this same file, re-invoked with
 *      `node --import tsx` so the child can import the real TypeScript
 *      `saveConfig()` pipeline directly with no separate build step) that
 *      writes a large "new" JSON payload over the target using the real
 *      atomic-write pipeline (packages/config-io/src/atomic-write.ts),
 *      validated with an always-pass stub so this harness isolates write
 *      atomicity, not validation (that's atomic-write.test.ts's job).
 *   3. The child prints a single-line marker to stdout immediately before
 *      calling saveConfig(); the parent waits for that marker (rather than
 *      timing from process spawn, which would otherwise be swallowed by
 *      Node/tsx startup overhead) and then SIGKILLs the child after a
 *      randomized sub-millisecond-to-few-millisecond delay, aiming to land
 *      inside the write window.
 *   4. The parent reads the target file and asserts it JSON.parses AND
 *      deep-equals EITHER the full old payload OR the full new payload —
 *      never truncated/partial content.
 *
 * Exits 0 with a printed pass tally if every iteration leaves the file
 * fully old-or-new; exits non-zero if any iteration leaves a truncated or
 * unparseable file.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..', '..');

const WRITE_STARTING_MARKER = 'GSDCM_WRITE_STARTING';

// Known "old" and "new" payloads. NEW_PAYLOAD is deliberately large (a few
// hundred KB) so the write is not instantaneous, maximizing the chance a
// mid-flight kill lands inside the write window rather than always
// finishing (or never starting) before the kill signal arrives.
const OLD_PAYLOAD = { marker: 'old', data: 'x'.repeat(50_000) };
const NEW_PAYLOAD = { marker: 'new', data: 'y'.repeat(400_000) };

if (process.env.GSDCM_STRESS_CHILD === '1') {
  await runChild();
} else {
  await runParent();
}

/**
 * Child process body: performs exactly one real saveConfig() write of
 * NEW_PAYLOAD over the target path, using an always-pass validator stub.
 * Any error here is logged but does not itself fail the harness — the
 * parent's post-kill file-shape check is the actual assertion.
 */
async function runChild() {
  const targetPath = process.env.GSDCM_TARGET;
  const { saveConfig } = await import('../../packages/config-io/src/atomic-write.js');
  const alwaysPass = () => ({ valid: true, errors: [] });

  // Emit the marker BEFORE calling saveConfig so the parent's kill-delay
  // countdown starts at "about to write", not at "process spawned"
  // (Node/tsx startup overhead would otherwise consume the whole window).
  process.stdout.write(`${WRITE_STARTING_MARKER}\n`);

  try {
    await saveConfig(targetPath, NEW_PAYLOAD, alwaysPass);
    process.exit(0);
  } catch (err) {
    console.error('[child] saveConfig error (parent still verifies on-disk file shape):', err);
    process.exit(1);
  }
}

async function runParent() {
  const iterations = Number(process.argv[2]) || 20;
  const workDir = mkdtempSync(join(tmpdir(), 'gsdcm-kill-mid-save-'));
  const targetPath = join(workDir, 'config.json');

  let passed = 0;
  let failed = 0;

  console.log(`kill-mid-save stress harness: ${iterations} iteration(s)`);
  console.log(`target file: ${targetPath}`);

  for (let i = 1; i <= iterations; i++) {
    writeFileSync(targetPath, JSON.stringify(OLD_PAYLOAD, null, 2), 'utf8');

    // eslint-disable-next-line no-await-in-loop -- iterations are intentionally sequential (one kill at a time)
    const outcome = await runOneKillIteration(targetPath);

    if (outcome.ok) {
      passed++;
      console.log(`  [${i}/${iterations}] OK (file is fully "${outcome.which}")`);
    } else {
      failed++;
      console.error(`  [${i}/${iterations}] FAIL: ${outcome.reason}`);
    }
  }

  rmSync(workDir, { recursive: true, force: true });

  console.log('');
  console.log(`kill-mid-save results: ${passed} passed, ${failed} failed (of ${iterations})`);

  if (failed > 0) {
    console.error('FAILURE: at least one iteration left a truncated/unparseable file.');
    process.exit(1);
  }

  console.log('PASS: every iteration left the file fully old-or-new content.');
  process.exit(0);
}

/** Spawns one child, kills it mid-flight, and returns the post-kill file-shape check. */
async function runOneKillIteration(targetPath) {
  const child = spawn(process.execPath, ['--import', 'tsx', __filename], {
    cwd: repoRoot,
    env: {
      ...process.env,
      GSDCM_STRESS_CHILD: '1',
      GSDCM_TARGET: targetPath,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  await waitForWriteStartingMarker(child);

  // Randomized sub-millisecond-to-few-millisecond delay after the marker,
  // aiming to land the kill inside the actual write window.
  const killDelayMs = Math.random() * 5; // 0-5ms
  await sleep(killDelayMs);

  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGKILL');
  await exited;

  return checkTargetFile(targetPath);
}

function waitForWriteStartingMarker(child) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes(WRITE_STARTING_MARKER)) settle();
    });
    // Fallback ceiling in case the marker is lost or the child exits before
    // emitting it (e.g. import/startup failure) — never hang the harness.
    setTimeout(settle, 2000);
    child.once('exit', settle);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkTargetFile(targetPath) {
  let raw;
  try {
    raw = readFileSync(targetPath, 'utf8');
  } catch (err) {
    return { ok: false, reason: `target file unreadable: ${err.message}` };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: `target file did not JSON.parse (truncated/corrupt): ${err.message}` };
  }

  if (deepEqualJson(parsed, OLD_PAYLOAD)) return { ok: true, which: 'old' };
  if (deepEqualJson(parsed, NEW_PAYLOAD)) return { ok: true, which: 'new' };
  return {
    ok: false,
    reason: 'target file parsed but matches neither the old nor the new payload (partial/corrupt content)',
  };
}

function deepEqualJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
