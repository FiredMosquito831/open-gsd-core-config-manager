// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWeb } from './render-helpers';
import { Differ } from 'json-diff-kit';
import { useUiStore } from '../../web/src/state/uiStore.js';

const SECRET = 'history-sensitive-sentinel-never-display';

vi.mock('../../web/src/api/configs.js', () => ({
  listHistory: vi.fn(),
  getHistorySnapshot: vi.fn(),
  restoreHistorySnapshot: vi.fn(),
}));

import { listHistory, getHistorySnapshot } from '../../web/src/api/configs.js';
import { HistoryWorkspace } from '../../web/src/components/history/HistoryWorkspace.js';

const now = new Date().toISOString();
const snapshot = {
  seq: 7,
  timestamp: now,
  config: {
    mode: 'interactive',
    integrations: { apiKey: SECRET },
    agents: ['planner', 'reviewer'],
    deeply: { nested: { longValue: 'x'.repeat(200) } },
  },
};

const current = {
  mode: 'autonomous',
  integrations: { apiKey: SECRET },
  agents: ['planner', 'executor'],
  deeply: { nested: { longValue: 'y'.repeat(200), added: true } },
};

const snapshots = [
  { seq: 7, timestamp: now, contentHash: 'seven' },
  { seq: 6, timestamp: new Date(Date.now() - 60_000).toISOString(), contentHash: 'six' },
];

beforeEach(() => {
  vi.mocked(listHistory).mockResolvedValue(snapshots);
  vi.mocked(getHistorySnapshot).mockResolvedValue({
    snapshot: { ...snapshots[0], document: snapshot.config },
    current,
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  useUiStore.setState({
    activeConfigId: null,
    activeChapter: null,
    leftPaneOpen: true,
    middlePaneOpen: true,
    searchQuery: '',
    searchOpen: false,
    highlightTarget: null,
    workspaceMode: 'editor',
    selectedHistorySeq: null,
  });
});

describe('History workspace contract (SAVE-05)', () => {
  it('uses json-diff-kit structurally for nested, array, add, remove, and modification output', () => {
    const [before, after] = new Differ({ showModifications: true, arrayDiffMethod: 'lcs' }).diff(snapshot.config, current);
    const types = new Set([...before, ...after].map(({ type }) => type));
    expect(types).toEqual(expect.objectContaining(new Set(['modify', 'add', 'remove'])));
    expect([...before, ...after].some(({ text }) => text.includes('agents'))).toBe(true);
  });

  it('renders a config-specific History landmark with no chapter or search navigation', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={{ mode: 'changed' }} />);
    expect(await screen.findByRole('main', { name: 'History for project/config.json' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to editor' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Chapters' })).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('groups the complete newest-first timeline and selects the newest snapshot', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} />);
    expect(await screen.findByText('Today')).toBeTruthy();
    const rows = screen.getAllByRole('button', { name: /Snapshot #/ });
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('aria-current')).toBe('true');
    expect(within(rows[0]).getByText('Snapshot #7')).toBeTruthy();
    expect(within(rows[0]).getByText('Calculating changes…')).toBeTruthy();
    expect(within(rows[0]).getByText(/just now|ago/)).toBeTruthy();
  });

  it('renders Snapshot-to-current orientation, exhaustive changed paths, text states, and unchanged controls', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} />);
    expect(await screen.findByText('Snapshot → Current saved file')).toBeTruthy();
    expect(screen.getByText(/Added: 1/)).toBeTruthy();
    expect(screen.getByText(/Changed:/)).toBeTruthy();
    expect(screen.getAllByText('deeply.nested.added').length).toBeGreaterThan(0);
    const unchanged = screen.getByRole('button', { name: 'Expand unchanged branches' });
    expect(unchanged.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(unchanged);
    expect(unchanged.getAttribute('aria-expanded')).toBe('true');
  });

  it('projects sensitive values before all diff rendering and never provides a reveal control', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} />);
    await screen.findByText('Snapshot → Current saved file');
    expect(document.body.textContent).not.toContain(SECRET);
    expect(screen.queryByText(/Show full value/)).toBeNull();
  });

  it('renders the exact calm empty state without a fabricated current version', async () => {
    vi.mocked(listHistory).mockResolvedValueOnce([]);
    renderWeb(<HistoryWorkspace configId="empty" configName="empty/config.json" draft={null} />);
    expect(await screen.findByText('No saved versions yet')).toBeTruthy();
    expect(screen.getByText('History starts after you change and successfully save this existing config. Your current file is not shown as a restorable version.')).toBeTruthy();
    expect(screen.queryByText('Current version')).toBeNull();
  });

  it('exposes compact and narrow workspace states at the approved responsive thresholds', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} viewportWidth={900} />);
    expect((await screen.findByRole('main')).className).toMatch(/history--compact/);
    cleanup();
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} viewportWidth={768} />);
    expect((await screen.findByRole('main')).className).toMatch(/history--stacked/);
  });

  // SAVE-06 restore dialogs/mutation are deliberately owned by Plan 05-06.
  it.skip('requires explicit dirty-draft restore choices', () => {});
  it.skip('gives the restore review dialog modal keyboard behavior', () => {});
  it.skip('clears drafts and invalidates queries after restoring', () => {});
});
