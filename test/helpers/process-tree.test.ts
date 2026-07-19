import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { terminateProcessTree } from './process-tree.js';

function waitForExit(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve) => child.once('exit', () => resolve()));
}

describe('terminateProcessTree', () => {
  it('terminates a detached process group', async () => {
    if (process.platform === 'win32') return;

    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], {
      detached: true,
      stdio: 'ignore',
    });
    const exited = waitForExit(child);

    await terminateProcessTree(child);
    await exited;

    expect(child.exitCode === null && child.signalCode === null).toBe(false);
  });
});
