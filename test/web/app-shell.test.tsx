// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUiStore } from '../../web/src/state/uiStore.js';

vi.mock('../../web/src/api/configs.js', () => ({
  loadConfig: vi.fn(),
  listHistory: vi.fn(),
  getHistorySnapshot: vi.fn(),
  restoreConfigSnapshot: vi.fn(),
}));
vi.mock('../../web/src/api/schema.js', () => ({ getSchema: vi.fn(), getSchemaStatus: vi.fn() }));

import { listHistory, loadConfig } from '../../web/src/api/configs.js';
import { getSchema, getSchemaStatus } from '../../web/src/api/schema.js';
import { cleanup, screen, fireEvent, render } from '@testing-library/react';
import { AppShell } from '../../web/src/components/AppShell';
import { App } from '../../web/src/App';
import { renderWeb } from './render-helpers';

beforeEach(() => {
  vi.mocked(loadConfig).mockResolvedValue({ raw: { project: { mode: 'interactive' }, global: null }, effective: {}, unknown: [], meta: { globalDefaultsFound: false, globalDefaultsPath: '' } });
  vi.mocked(getSchema).mockResolvedValue({});
  vi.mocked(getSchemaStatus).mockResolvedValue({ source: 'bundled', gsdCoreVersion: '1.7.0' });
  vi.mocked(listHistory).mockResolvedValue([]);
  useUiStore.setState({
    activeConfigId: null,
    workspaceMode: 'editor',
    selectedHistorySeq: null,
    leftPaneOpen: true,
    middlePaneOpen: true,
    searchQuery: '',
    searchOpen: false,
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  window.history.replaceState({}, '', '/');
});

function renderApp() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App connected /></QueryClientProvider>);
}

describe('AppShell', () => {
  it('renders three pane landmarks and toggle controls', () => {
    render(
      <AppShell
        sidebar={<div>Sidebar content</div>}
        chapterNav={<div>Chapter content</div>}
        editor={<div>Editor content</div>}
        leftOpen={true}
        middleOpen={true}
        onToggleLeft={vi.fn()}
        onToggleMiddle={vi.fn()}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Tracked configurations')).toBeTruthy();
    expect(screen.getByLabelText('Chapters')).toBeTruthy();
    expect(screen.getByLabelText('Editor')).toBeTruthy();
    expect(screen.getByText('Sidebar content')).toBeTruthy();
    expect(screen.getByText('Chapter content')).toBeTruthy();
    expect(screen.getByText('Editor content')).toBeTruthy();
  });

  it('calls toggle handlers when rail buttons are clicked', () => {
    const onToggleLeft = vi.fn();
    const onToggleMiddle = vi.fn();
    render(
      <AppShell
        sidebar={<div>Sidebar</div>}
        chapterNav={<div>Chapters</div>}
        editor={<div>Editor</div>}
        leftOpen={true}
        middleOpen={true}
        onToggleLeft={onToggleLeft}
        onToggleMiddle={onToggleMiddle}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse tracked configs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse chapters' }));

    expect(onToggleLeft).toHaveBeenCalledOnce();
    expect(onToggleMiddle).toHaveBeenCalledOnce();
  });

  it('shows the editor empty state when no config is selected', () => {
    renderWeb(<App connected />);

    expect(screen.getByLabelText('Tracked configurations')).toBeTruthy();
    expect(screen.getByLabelText('Chapters')).toBeTruthy();
    expect(screen.getByLabelText('Editor')).toBeTruthy();
    expect(screen.getByText('Select a configuration')).toBeTruthy();
  });

  it('renders exactly one production main landmark in editor and history modes', () => {
    renderApp();
    expect(screen.getAllByRole('main', { name: 'Editor' })).toHaveLength(1);

    cleanup();
    useUiStore.setState({ workspaceMode: 'history' });
    renderApp();
    expect(screen.getAllByRole('main', { name: 'Version history' })).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});
