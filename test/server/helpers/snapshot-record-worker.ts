import { saveWithSnapshot } from '../../../packages/server/src/snapshot-store/save-with-snapshot.js';

const [configPath, snapshotRoot, nextContent] = process.argv.slice(2);
if (!configPath || !snapshotRoot || nextContent === undefined) {
  process.exitCode = 1;
} else {
  const nextConfig: unknown = JSON.parse(nextContent);
  if (!nextConfig || Array.isArray(nextConfig) || typeof nextConfig !== 'object') {
    process.exitCode = 1;
  } else {
    saveWithSnapshot(configPath, nextConfig, () => ({ valid: true, errors: [] }), { root: snapshotRoot }).then(
      (result) => {
        if (!result.ok) process.exitCode = 1;
      },
      (error: unknown) => {
        process.stderr.write(error instanceof Error ? error.message : 'Snapshot worker failed');
        process.exitCode = 1;
      },
    );
  }
}
