import { writeFileSync } from 'node:fs';
import { bootstrap } from '../packages/cli/src/bootstrap.js';
import { createOutput } from '../packages/cli/src/output.js';

// interpose our banner() to intercept the URL before the stream write, so
// we do NOT depend on terminal-buffer flushing at all.
const urlChannel: string[] = [];
const captured = {
  banner(url: string) {
    urlChannel.push(url);
    // still show the user the normal output
    createOutput().banner(url);
  },
  noOpenHint() { createOutput().noOpenHint(); },
  openFailed(url: string) { createOutput().openFailed(url); },
  portInUse(port: number) { createOutput().portInUse(port); },
  startupError(message: string) { createOutput().startupError(message); },
  shuttingDown() { createOutput().shuttingDown(); },
  stopped() { createOutput().stopped(); },
  warnLine(message: string) { createOutput().warnLine(message); },
} as any;

(async () => {
  const handle = await bootstrap({ open: false }, { out: captured });
  const url = urlChannel[0] ?? handle.url;
  const meta = { url, port: handle.port, token: handle.token, pid: process.pid };
  writeFileSync('/tmp/gsd-probe.meta.json', JSON.stringify(meta, null, 2));
  // keep-alive (press Ctrl+C in the code-host shell to stop)
  await new Promise(() => {});
})().catch((e) => { console.error(e); process.exit(1); });
