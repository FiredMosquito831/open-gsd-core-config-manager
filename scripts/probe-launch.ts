// One-off launcher for manual verification via Chrome DevTools MCP.
// Calls the real bootstrap (same server/CLI entrypoint as `gsd-config-editor`),
// writes the URL+port+token to a file synchronously so the test driver can read
// them without fighting Node's stdout block-buffering, then stays alive until
// the file /tmp/gsd-probe.stop appears (the driver deletes the process).
import { writeFileSync } from 'node:fs';
import { bootstrap } from '../packages/cli/src/bootstrap.js';
import { createOutput } from '../packages/cli/src/output.js';

async function main() {
  const handle = await bootstrap({ open: false }, { out: createOutput() });
  const meta = {
    url: handle.url,
    port: handle.port,
    token: handle.token,
    pid: process.pid,
  };
  writeFileSync('/tmp/gsd-probe.meta.json', JSON.stringify(meta, null, 2));
  // keep alive until signalled
  const tick = setInterval(() => {}, 1000);
  const stopCheck = setInterval(() => {
    try {
      // a marker file lets the driver request a clean shutdown
      const { existsSync } = require('node:fs') as typeof import('node:fs');
      if (existsSync('/tmp/gsd-probe.stop')) {
        clearInterval(tick);
        clearInterval(stopCheck);
        handle.shutdown().finally(() => process.exit(0));
      }
    } catch {
      /* ignore */
    }
  }, 500);
}

main().catch((err) => {
  console.error('probe-launch failed:', err);
  process.exit(1);
});

// Stop on SIGINT/SIGTERM as well (belt & suspenders).
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
