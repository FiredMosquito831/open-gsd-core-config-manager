import { recordSnapshot } from '../../../packages/server/src/snapshot-store/index.js';

const [configPath, snapshotRoot, priorContent] = process.argv.slice(2);
if (!configPath || !snapshotRoot || priorContent === undefined) {
  process.exitCode = 1;
} else {
  recordSnapshot(configPath, priorContent, snapshotRoot).catch((error: unknown) => {
    process.stderr.write(error instanceof Error ? error.message : 'Snapshot worker failed');
    process.exitCode = 1;
  });
}
