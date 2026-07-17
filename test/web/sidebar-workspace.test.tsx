// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWeb } from './render-helpers';
import { App } from '../../web/src/App';

vi.mock('../../web/src/api/workspace.js', async () => {
  const actual = await vi.importActual('../../web/src/api/workspace.js') as object;
  return {
    ...actual,
    listWorkspaceConfigs: vi.fn(),
    locateWorkspace: vi.fn(),
    removeWorkspace: vi.fn(),
  };
});

vi.mock('../../web/src/api/configs.js', async () => {
  const actual = await vi.importActual('../../web/src/api/configs.js') as object;
  return {
    ...actual,
    loadConfig: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('sidebar', () => {
  it('lists persisted configs in saved order', async () => {
    const { listWorkspaceConfigs } = await import('../../web/src/api/workspace.js');
    vi.mocked(listWorkspaceConfigs).mockResolvedValue([
      { id: '1', path: '/alpha/.planning/config.json', name: 'alpha/config.json', status: 'ok' },
      { id: '2', path: '/beta/.planning/config.json', name: 'beta/config.json', status: 'missing', problem: 'Config file not found' },
    ]);

    renderWeb(<App connected />);

    await waitFor(() => {
      expect(screen.getByText('alpha/config.json')).toBeTruthy();
      expect(screen.getByText('beta/config.json')).toBeTruthy();
    });
  });

  it('sets active config and loads data when clicking a ready config', async () => {
    const { listWorkspaceConfigs } = await import('../../web/src/api/workspace.js');
    const { loadConfig } = await import('../../web/src/api/configs.js');
    vi.mocked(listWorkspaceConfigs).mockResolvedValue([
      { id: '1', path: '/alpha/.planning/config.json', name: 'alpha/config.json', status: 'ok' },
    ]);
    vi.mocked(loadConfig).mockResolvedValue({
      raw: { project: {}, global: null },
      effective: {},
      unknown: [],
      meta: { globalDefaultsPath: '/home/user/.gsd/defaults.json', globalDefaultsFound: true },
    });

    renderWeb(<App connected />);

    await waitFor(() => screen.getByText('alpha/config.json'));
    fireEvent.click(screen.getByText('alpha/config.json'));

    await waitFor(() => {
      expect(loadConfig).toHaveBeenCalledWith('1');
    });
    expect(screen.getByText('Ready to edit')).toBeTruthy();
  });

  it('disables editing for missing entries and shows recovery actions', async () => {
    const { listWorkspaceConfigs } = await import('../../web/src/api/workspace.js');
    vi.mocked(listWorkspaceConfigs).mockResolvedValue([
      { id: '2', path: '/beta/.planning/config.json', name: 'beta/config.json', status: 'missing', problem: 'Config file not found' },
    ]);

    renderWeb(<App connected />);

    await waitFor(() => screen.getByText('beta/config.json'));
    const button = screen.getByText('beta/config.json').closest('button');
    expect(button).toBeDisabled();
    expect(screen.getByText('Config file not found')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Locate again' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('remove only deletes the tracked-list entry, not the filesystem file', async () => {
    const { listWorkspaceConfigs, removeWorkspace } = await import('../../web/src/api/workspace.js');
    vi.mocked(listWorkspaceConfigs).mockResolvedValue([
      { id: '2', path: '/beta/.planning/config.json', name: 'beta/config.json', status: 'missing', problem: 'Config file not found' },
    ]);
    vi.mocked(removeWorkspace).mockResolvedValue({});

    renderWeb(<App connected />);

    await waitFor(() => screen.getByText('beta/config.json'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(removeWorkspace).toHaveBeenCalledWith('2');
    });
  });

  it('locate again calls the locate workspace route with a new path', async () => {
    const { listWorkspaceConfigs, locateWorkspace } = await import('../../web/src/api/workspace.js');
    vi.mocked(listWorkspaceConfigs).mockResolvedValue([
      { id: '2', path: '/beta/.planning/config.json', name: 'beta/config.json', status: 'missing', problem: 'Config file not found' },
    ]);
    vi.mocked(locateWorkspace).mockResolvedValue({
      id: '2',
      path: '/gamma/.planning/config.json',
      name: 'gamma/config.json',
      status: 'ok',
    });

    renderWeb(<App connected />);

    await waitFor(() => screen.getByText('beta/config.json'));
    fireEvent.click(screen.getByRole('button', { name: 'Locate again' }));

    const input = await waitFor(() => screen.getByPlaceholderText('/home/projects/my-project/.planning/config.json'));
    fireEvent.change(input, { target: { value: '/gamma/.planning/config.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Locate' }));

    await waitFor(() => {
      expect(locateWorkspace).toHaveBeenCalledWith('2', '/gamma/.planning/config.json');
    });
  });
});
