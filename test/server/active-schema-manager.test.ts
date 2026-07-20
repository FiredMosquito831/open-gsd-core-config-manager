import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ActiveSchemaManager } from '../../packages/server/src/active-schema-manager.js';
import { SchemaOverrideStore, type PersistedSchemaOverride } from '../../packages/server/src/schema-persistence.js';
import { getBundledSchema, getBundledSchemaMetadata } from '../../packages/server/src/schema.js';

const roots: string[] = [];

function root(): string {
  const value = mkdtempSync(join(tmpdir(), 'gsdcm-active-schema-'));
  roots.push(value);
  return value;
}

function newerMetadata() {
  return {
    envelopeVersion: 1 as const,
    source: 'refreshed' as const,
    gsdCoreVersion: '1.8.0',
    tag: 'v1.8.0',
    commit: 'a'.repeat(40),
    archiveSha256: 'b'.repeat(64),
    generatedAt: '2026-07-20T12:00:00.000Z',
  };
}

function proposal() {
  return { schema: structuredClone(getBundledSchema()), metadata: newerMetadata() };
}

function overrideFor(next = proposal()): PersistedSchemaOverride {
  return {
    envelopeVersion: 1,
    schema: next.schema,
    metadata: next.metadata,
    activatedAt: '2026-07-20T12:00:00.000Z',
  };
}

afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('ActiveSchemaManager', () => {
  it('starts with one compiled immutable bundled snapshot when no override exists', async () => {
    const manager = await ActiveSchemaManager.create({ appDataRoot: root() });

    const snapshot = manager.snapshot();
    expect(snapshot.status.source).toBe('bundled');
    expect(snapshot.metadata).toEqual(getBundledSchemaMetadata());
    expect(snapshot.validator({ mode: 'interactive' }).valid).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('activates a valid newer stable override and persists one complete envelope before replacing the snapshot', async () => {
    const appDataRoot = root();
    const events: string[] = [];
    const store = new SchemaOverrideStore({
      appDataRoot,
      write: async (path, content) => {
        events.push('write');
        writeFileSync(path, content, 'utf8');
      },
    });
    const manager = await ActiveSchemaManager.create({ appDataRoot, store });
    const previous = manager.snapshot();

    await manager.activateValidatedProposal(proposal());

    expect(events).toEqual(['write']);
    expect(manager.snapshot()).not.toBe(previous);
    expect(manager.snapshot().status.source).toBe('refreshed');
    const persisted = JSON.parse(readFileSync(store.filePath, 'utf8')) as PersistedSchemaOverride;
    expect(persisted).toMatchObject({ envelopeVersion: 1, schema: getBundledSchema(), metadata: newerMetadata() });
  });

  it('uses a valid newer persisted override but does not allow an older override to shadow the bundle', async () => {
    const appDataRoot = root();
    const store = new SchemaOverrideStore({ appDataRoot });
    await store.write(overrideFor());
    const refreshed = await ActiveSchemaManager.create({ appDataRoot, store });
    expect(refreshed.snapshot().status.source).toBe('refreshed');

    await store.write(overrideFor({ schema: structuredClone(getBundledSchema()), metadata: { ...newerMetadata(), gsdCoreVersion: '1.0.0', tag: 'v1.0.0' } }));
    const bundled = await ActiveSchemaManager.create({ appDataRoot, store });
    expect(bundled.snapshot().status.source).toBe('bundled');
  });

  it('fails closed to the bundle on same-semver different immutable identity rather than trusting equal version text', async () => {
    const appDataRoot = root();
    const baseline = getBundledSchemaMetadata();
    const store = new SchemaOverrideStore({ appDataRoot });
    await store.write(overrideFor({
      schema: structuredClone(getBundledSchema()),
      metadata: { ...newerMetadata(), gsdCoreVersion: baseline.gsdCoreVersion, tag: baseline.tag, commit: 'c'.repeat(40) },
    }));

    const manager = await ActiveSchemaManager.create({ appDataRoot, store });

    expect(manager.snapshot().status).toMatchObject({ source: 'bundled', warning: 'Saved schema override was ignored; the bundled schema is active.' });
  });

  it.each([
    ['malformed JSON', '{'],
    ['wrong envelope version', JSON.stringify({ ...overrideFor(), envelopeVersion: 2 })],
    ['unsafe metadata', JSON.stringify({ ...overrideFor(), metadata: { ...newerMetadata(), commit: '../unsafe' } })],
    ['uncompilable schema', JSON.stringify({ ...overrideFor(), schema: { broken: { type: 'not-a-type' } } })],
  ])('recovers from %s with a static path-free persistent warning', async (_name, content) => {
    const appDataRoot = root();
    const store = new SchemaOverrideStore({ appDataRoot });
    await store.writeRawForTest(content);

    const manager = await ActiveSchemaManager.create({ appDataRoot, store });

    expect(manager.snapshot().status).toMatchObject({ source: 'bundled', warning: 'Saved schema override was ignored; the bundled schema is active.' });
    expect(manager.snapshot().status.warning).not.toContain(appDataRoot);
  });

  it('retains the previous reference when compilation or persistence fails', async () => {
    const appDataRoot = root();
    const store = new SchemaOverrideStore({ appDataRoot, write: async () => { throw new Error('disk unavailable'); } });
    const manager = await ActiveSchemaManager.create({ appDataRoot, store });
    const previous = manager.snapshot();

    await expect(manager.activateValidatedProposal({ schema: { broken: { type: 'not-a-type' } }, metadata: newerMetadata() })).rejects.toThrow();
    expect(manager.snapshot()).toBe(previous);
    await expect(manager.activateValidatedProposal(proposal())).rejects.toThrow();
    expect(manager.snapshot()).toBe(previous);
  });

  it('removes the override before reset swaps the snapshot, and retains the old reference if removal fails', async () => {
    const appDataRoot = root();
    const store = new SchemaOverrideStore({ appDataRoot });
    const manager = await ActiveSchemaManager.create({ appDataRoot, store });
    await manager.activateValidatedProposal(proposal());
    const refreshed = manager.snapshot();

    await manager.resetToBundled();
    expect(existsSync(store.filePath)).toBe(false);
    expect(manager.snapshot()).not.toBe(refreshed);
    expect(manager.snapshot().status.source).toBe('bundled');

    const failingStore = new SchemaOverrideStore({ appDataRoot: root(), remove: async () => { throw new Error('cannot remove'); } });
    const failingManager = await ActiveSchemaManager.create({ appDataRoot: failingStore.appDataRoot, store: failingStore });
    await failingManager.activateValidatedProposal(proposal()).catch(() => undefined);
    const previous = failingManager.snapshot();
    await expect(failingManager.resetToBundled()).rejects.toThrow();
    expect(failingManager.snapshot()).toBe(previous);
  });

  it('never touches a tracked config fixture or the bundled artifact during lifecycle operations', async () => {
    const appDataRoot = root();
    const trackedConfig = join(appDataRoot, 'tracked-config.json');
    writeFileSync(trackedConfig, '{"mode":"interactive"}', 'utf8');
    const before = readFileSync(trackedConfig, 'utf8');
    const manager = await ActiveSchemaManager.create({ appDataRoot });
    await manager.activateValidatedProposal(proposal());
    await manager.resetToBundled();

    expect(readFileSync(trackedConfig, 'utf8')).toBe(before);
    expect(getBundledSchema()).toEqual(JSON.parse(readFileSync(join(process.cwd(), 'packages/schema-data/bundled-schema.json'), 'utf8')));
  });
});
