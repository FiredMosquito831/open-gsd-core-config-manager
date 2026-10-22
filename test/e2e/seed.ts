/**
 * E2E workspace seeding.
 *
 * The editor only renders chapters once a tracked config is selected. A clean
 * GitHub runner has an empty workspace store, so the previous suite timed out
 * waiting for `.gsd-chapter-view`. Seed one tracked config per worker from the
 * repository fixture, copied to an OS temp directory so tests never mutate the
 * checked-in fixture.
 */
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIRequestContext } from '@playwright/test';

let seeded: Promise<void> | undefined;

async function seed(request: APIRequestContext): Promise<void> {
  const list = await request.get('/api/workspace/configs');
  if (list.ok()) {
    const body = (await list.json()) as { configs?: Array<{ status?: string }> };
    if (body.configs?.some((config) => config.status === 'ok')) return;
  }

  const dir = mkdtempSync(join(tmpdir(), 'gsd-config-manager-e2e-'));
  const target = join(dir, '.planning', 'config.json');
  mkdirSync(join(dir, '.planning'), { recursive: true });
  copyFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'project-config.json'), target);

  const added = await request.post('/api/workspace/configs/track', { data: { path: target } });
  if (!added.ok() && added.status() !== 409) {
    throw new Error(`Failed to seed E2E config: ${added.status()} ${await added.text()}`);
  }
}

export function ensureTrackedConfig(request: APIRequestContext): Promise<void> {
  seeded ??= seed(request);
  return seeded;
}
