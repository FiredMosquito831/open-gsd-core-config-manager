import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Terminates a spawned test process and every descendant it launched.
 *
 * Unix callers must spawn the root with `detached: true` so its PID is also a
 * process-group ID. Windows has no equivalent process group, so taskkill's
 * `/T` tree switch is required. This is test-harness cleanup only: production
 * shutdown behavior remains covered by the IPC signal assertions.
 */
export async function terminateProcessTree(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;

  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('error', () => {
        child.kill('SIGKILL');
        resolve();
      });
      killer.once('exit', () => resolve());
    });
    return;
  }

  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // The process may have exited between the guard above and the signal, or
    // may not have formed a group on an unusual platform. Kill the root as a
    // safe fallback so test cleanup never leaks it.
    child.kill('SIGKILL');
  }
}
