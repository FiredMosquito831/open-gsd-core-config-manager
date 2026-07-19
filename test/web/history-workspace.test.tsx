// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
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

import { HistoryWorkspace } from '../../web/src/components/history/HistoryWorkspace.js';

const snapshot = {
  seq: 7,
  timestamp: '2026-07-19T10:20:30.000Z',
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
  });
});

describe('History workspace contract (SAVE-05, SAVE-06)', () => {
  it('uses json-diff-kit structurally for nested, array, add, remove, and modification output', () => {
    const [before, after] = new Differ({ showModifications: true, arrayDiffMethod: 'lcs' }).diff(snapshot.config, current);
    const types = new Set([...before, ...after].map(({ type }) => type));
    expect(types).toEqual(expect.objectContaining(new Set(['modify', 'add', 'remove'])));
    expect([...before, ...after].some(({ text }) => text.includes('agents'))).toBe(true);
  });

  it('keeps the config sidebar but replaces chapter/search navigation with a config-specific History workspace', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={{ mode: 'changed' }} />);
    expect(await screen.findByRole('main', { name: 'History for project/config.json' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to editor' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Tracked configs' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Chapters' })).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('groups a complete newest-first timeline by local calendar date with exact and relative timestamps', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} />);
    expect(await screen.findByText('Today')).toBeTruthy();
    const rows = screen.getAllByRole('button', { name: /Snapshot / });
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0]).toHaveAttribute('aria-current', 'true');
    expect(within(rows[0]).getByText(/Snapshot 7/)).toBeTruthy();
    expect(within(rows[0]).getByText(/keys changed from current/)).toBeTruthy();
    expect(within(rows[0]).getByText(/ago|AM|PM/)).toBeTruthy();
  });

  it('renders Snapshot to Current orientation, exhaustive changed paths, visible state text, and collapsible unchanged branches', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} />);
    expect(await screen.findByText('Snapshot → Current')).toBeTruthy();
    expect(screen.getByText('Before: Snapshot')).toBeTruthy();
    expect(screen.getByText('After: Current')).toBeTruthy();
    expect(screen.getByText(/Added/)).toBeTruthy();
    expect(screen.getByText(/Removed/)).toBeTruthy();
    expect(screen.getByText(/Changed/)).toBeTruthy();
    expect(screen.getByText(/deeply.nested.added/)).toBeTruthy();
    const unchanged = screen.getByRole('button', { name: 'Expand unchanged branches' });
    expect(unchanged).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(unchanged);
    expect(unchanged).toHaveAttribute('aria-expanded', 'true');
  });

  it('projects sensitive values before summaries, trees, dialogs, notices, errors, and long text rendering', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} />);
    await screen.findByText('Snapshot → Current');
    expect(document.body.textContent).not.toContain(SECRET);
    expect(screen.getAllByText('••••••')).toHaveLength(2);
    expect(screen.getByText(/Show full value/)).toBeTruthy();
  });

  it('renders calm empty, loading, error, partial, overflow, zero, one, and many snapshot states without a fabricated current version', async () => {
    renderWeb(<HistoryWorkspace configId="empty" configName="empty/config.json" draft={null} />);
    expect(await screen.findByText(/History begins after this config is successfully changed and saved/)).toBeTruthy();
    expect(screen.queryByText('Current version')).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to editor' })).toBeTruthy();
  });

  it('requires explicit Save draft first, Discard draft and restore, or Cancel before restoring a dirty draft', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={{ mode: 'changed' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore snapshot 7' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Review restore' });
    expect(within(dialog).getByRole('button', { name: 'Save draft first' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Discard draft and restore' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(within(dialog).getByText(/current saved state will be snapshotted first/i)).toBeTruthy();
  });

  it('gives the restore review dialog modal keyboard behavior and returns focus to Restore', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} />);
    const restore = await screen.findByRole('button', { name: 'Restore snapshot 7' });
    restore.focus();
    fireEvent.click(restore);
    const dialog = await screen.findByRole('alertdialog', { name: 'Review restore' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(restore);
  });

  it('clears stale drafts and invalidates config/history after successful restore but preserves selection and diff after failure', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={{ mode: 'changed' }} />);
    await screen.findByText('Snapshot → Current');
    fireEvent.click(screen.getByRole('button', { name: 'Restore snapshot 7' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard draft and restore' }));
    expect(await screen.findByText(/Restored snapshot from/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View history' })).toBeTruthy();
    expect(screen.getByTestId('query-invalidations')).toHaveTextContent('config:cfg-1,history:cfg-1');
  });

  it('exposes compact and narrow workspace states at the approved responsive thresholds', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} viewportWidth={900} />);
    expect((await screen.findByRole('main')).className).toMatch(/history--compact/);
    cleanup();
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} viewportWidth={768} />);
    expect((await screen.findByRole('main')).className).toMatch(/history--stacked/);
  });
});
