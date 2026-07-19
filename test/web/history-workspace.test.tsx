// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { queryClient } from '../../web/src/state/queryClient.js';
import { renderWeb } from './render-helpers';
import { Differ } from 'json-diff-kit';
import { useUiStore } from '../../web/src/state/uiStore.js';

const SECRET = 'history-sensitive-sentinel-never-display';

vi.mock('../../web/src/api/configs.js', () => ({
  listHistory: vi.fn(),
  getHistorySnapshot: vi.fn(),
  restoreConfigSnapshot: vi.fn(),
  loadConfig: vi.fn(),
}));

import { listHistory, getHistorySnapshot, restoreConfigSnapshot, loadConfig } from '../../web/src/api/configs.js';
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
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  vi.mocked(listHistory).mockResolvedValue(snapshots);
  vi.mocked(getHistorySnapshot).mockResolvedValue({
    snapshot: { ...snapshots[0], document: snapshot.config },
    current,
  });
  vi.mocked(restoreConfigSnapshot).mockResolvedValue({});
  vi.mocked(loadConfig).mockResolvedValue({ raw: { project: current, global: null }, effective: {}, unknown: [], meta: { globalDefaultsFound: false, globalDefaultsPath: '' } });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  document.getElementById('root')?.remove();
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
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} />);
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
    expect(within(rows[0]).getByText(/Calculating changes…|keys? changed/)).toBeTruthy();
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

  it('requires explicit dirty-draft restore choices', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={{
      isDirty: true,
      saveDraft: vi.fn(async () => 'saved' as const),
      resetFromServer: vi.fn(),
    }} />);
    expect(await screen.findByRole('button', { name: 'Restore this snapshot' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore this snapshot' }));
    expect(await screen.findByRole('alertdialog', { name: 'Restore snapshot' })).toBeTruthy();
  });

  it('keeps the dirty-draft dialog usable after a deferred blocked save', async () => {
    let resolveSave!: (outcome: 'blocked') => void;
    const saveDraft = vi.fn(() => new Promise<'blocked'>((resolve) => { resolveSave = resolve; }));
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={{ isDirty: true, saveDraft, resetFromServer: vi.fn() }} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Restore this snapshot' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore snapshot' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Unsaved changes' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save draft first' }));
    expect((within(dialog).getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);

    resolveSave('blocked');
    await waitFor(() => expect((within(dialog).getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByRole('alertdialog', { name: 'Unsaved changes' })).toBe(dialog);
  });

  it('closes after a deferred saved draft and invalidates config and history', async () => {
    let resolveSave!: (outcome: 'saved') => void;
    const saveDraft = vi.fn(() => new Promise<'saved'>((resolve) => { resolveSave = resolve; }));
    const { queryClient: testQueryClient } = renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={{ isDirty: true, saveDraft, resetFromServer: vi.fn() }} />);
    const invalidateQueries = vi.spyOn(testQueryClient, 'invalidateQueries');

    fireEvent.click(await screen.findByRole('button', { name: 'Restore this snapshot' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore snapshot' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Unsaved changes' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save draft first' }));
    expect((within(dialog).getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);

    resolveSave('saved');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['config', 'cfg-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['history', 'cfg-1'] });
  });

  it('recovers when saving a dirty draft rejects before restore without exposing the thrown details', async () => {
    const privateFailure = 'C:\\users\\private\\config.json save failed';
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={{
      isDirty: true,
      saveDraft: vi.fn(async () => { throw new Error(privateFailure); }),
      resetFromServer: vi.fn(),
    }} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Restore this snapshot' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore snapshot' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Unsaved changes' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save draft first' }));

    expect(await screen.findByText(/The draft could not be saved\. Try again\./)).toBeTruthy();
    expect(document.body.textContent).not.toContain(privateFailure);
    await waitFor(() => expect((within(dialog).getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('portals the restore review dialog outside the inert app, traps focus, and supports keyboard/click activation', async () => {
    const { container } = renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={null} />);
    const restoreButton = await screen.findByRole('button', { name: 'Restore this snapshot' });
    restoreButton.focus();
    fireEvent.click(restoreButton);

    const dialog = screen.getByRole('alertdialog', { name: 'Restore snapshot' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.getElementById('root')?.hasAttribute('inert')).toBe(true);
    expect(dialog.closest('[inert]')).toBeNull();
    expect(document.activeElement?.textContent).toBe('Cancel');

    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement?.textContent).toBe('Restore snapshot');
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement?.textContent).toBe('Cancel');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.getElementById('root')?.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(restoreButton);

    fireEvent.click(restoreButton);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('restores the selected snapshot, reloads server authority, clears the draft, and returns to the editor', async () => {
    const resetFromServer = vi.fn();
    const saveDraft = vi.fn(async () => 'saved' as const);
    const backToEditor = vi.fn();
    useUiStore.setState({ activeConfigId: 'cfg-1', backToEditor });
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={{ isDirty: false, saveDraft, resetFromServer }} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Restore this snapshot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore snapshot' }));

    await waitFor(() => {
      expect(restoreConfigSnapshot).toHaveBeenCalledWith('cfg-1', 7);
      expect(loadConfig).toHaveBeenCalledWith('cfg-1');
      expect(resetFromServer).toHaveBeenCalledTimes(1);
      const [reloaded] = vi.mocked(resetFromServer).mock.calls[0]!;
      expect(reloaded).toEqual(expect.objectContaining({
        raw: expect.objectContaining({ project: expect.objectContaining({ mode: 'autonomous' }) }),
      }));
      expect(backToEditor).toHaveBeenCalledTimes(1);
    });
  });

  it('reports partial success without retrying restore when authoritative reload fails', async () => {
    const resetFromServer = vi.fn();
    const backToEditor = vi.fn();
    vi.mocked(loadConfig).mockRejectedValueOnce(new Error('private reload failure'));
    useUiStore.setState({ activeConfigId: 'cfg-1', backToEditor });
    renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={{ isDirty: true, saveDraft: vi.fn(async () => 'saved' as const), resetFromServer }} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Restore this snapshot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore snapshot' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard draft and restore' }));

    expect(await screen.findByText('The snapshot was restored, but the editor could not reload it. Return to the editor and reload.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Your config was not changed');
    expect(document.body.textContent).not.toContain('private reload failure');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(resetFromServer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Return to editor' }));
    expect(backToEditor).toHaveBeenCalledTimes(1);
    expect(restoreConfigSnapshot).toHaveBeenCalledTimes(1);
  });

  it('reports partial success without retrying restore when history invalidation fails', async () => {
    const resetFromServer = vi.fn();
    useUiStore.setState({ activeConfigId: 'cfg-1' });
    const { queryClient: testQueryClient } = renderWeb(<HistoryWorkspace configId="cfg-1" configName="project/config.json" draft={{ isDirty: true, saveDraft: vi.fn(async () => 'saved' as const), resetFromServer }} />);
    vi.spyOn(testQueryClient, 'invalidateQueries').mockRejectedValueOnce(new Error('private invalidation failure'));

    fireEvent.click(await screen.findByRole('button', { name: 'Restore this snapshot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore snapshot' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard draft and restore' }));

    expect(await screen.findByText('The snapshot was restored, but the editor could not reload it. Return to the editor and reload.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Your config was not changed');
    expect(document.body.textContent).not.toContain('private invalidation failure');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(resetFromServer).toHaveBeenCalledTimes(1);
    expect(restoreConfigSnapshot).toHaveBeenCalledTimes(1);
  });

  it('progressive counts settle every returned row without truncating complete history', async () => {
    const many = [7, 6, 5, 4, 3].map((seq) => ({ seq, timestamp: new Date(Date.now() - seq * 60_000).toISOString(), contentHash: String(seq) }));
    vi.mocked(listHistory).mockResolvedValueOnce(many);
    vi.mocked(getHistorySnapshot).mockImplementation(async (_id, seq) => ({
      snapshot: { ...many.find((entry) => entry.seq === seq)!, document: { value: seq } },
      current: { value: 0 },
    }));

    renderWeb(<HistoryWorkspace configId="cfg-many" configName="many/config.json" draft={null} />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Snapshot #/ })).toHaveLength(5));
    await waitFor(() => expect(screen.getAllByText('1 key changed')).toHaveLength(5));
    expect(screen.queryAllByText('Calculating changes…')).toHaveLength(0);
    expect(vi.mocked(getHistorySnapshot).mock.calls.map(([, seq]) => seq)).toEqual(expect.arrayContaining([7, 6, 5, 4, 3]));
  });

  it('keeps background detail loading bounded and selected priority immediate', async () => {
    const many = [7, 6, 5, 4, 3].map((seq) => ({ seq, timestamp: new Date(Date.now() - seq * 60_000).toISOString(), contentHash: String(seq) }));
    const deferred = new Map<number, { resolve: (value: any) => void }>();
    let backgroundInFlight = 0;
    let peakBackgroundInFlight = 0;
    vi.mocked(listHistory).mockResolvedValueOnce(many);
    vi.mocked(getHistorySnapshot).mockImplementation((_id, seq) => new Promise((resolve) => {
      if (seq !== 7) {
        backgroundInFlight += 1;
        peakBackgroundInFlight = Math.max(peakBackgroundInFlight, backgroundInFlight);
      }
      deferred.set(seq, { resolve: (value) => { if (seq !== 7) backgroundInFlight -= 1; resolve(value); } });
    }));

    renderWeb(<HistoryWorkspace configId="cfg-priority" configName="priority/config.json" draft={null} />);
    await waitFor(() => expect(deferred.has(7)).toBe(true));
    expect(peakBackgroundInFlight).toBeLessThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /Snapshot #5/ }));
    await waitFor(() => expect(deferred.has(5)).toBe(true));
    expect(peakBackgroundInFlight).toBeLessThanOrEqual(2);
  });

  it('retries count detail twice at 250ms and 500ms then exposes an accessible row Retry', async () => {
    vi.useFakeTimers();
    vi.mocked(getHistorySnapshot).mockRejectedValue(new Error('detail failed'));
    renderWeb(<HistoryWorkspace configId="cfg-retry" configName="retry/config.json" draft={null} />);

    try {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(250);
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.mocked(getHistorySnapshot).mock.calls.filter(([, seq]) => seq === 6)).toHaveLength(3);
      expect(screen.getByRole('button', { name: 'Retry snapshot #6 comparison' })).toBeTruthy();
      expect(within(screen.getByRole('button', { name: /Snapshot #6/ })).queryByText('Calculating changes…')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not reuse a cached detail request after a fresh config selection', async () => {
    renderWeb(<HistoryWorkspace configId="cfg-old" configName="old/config.json" draft={null} />);
    await waitFor(() => expect(vi.mocked(getHistorySnapshot)).toHaveBeenCalledWith('cfg-old', 7));
    expect(vi.mocked(getHistorySnapshot).mock.calls.every(([id]) => id === 'cfg-old')).toBe(true);
  });
});
