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
    trackWorkspace: vi.fn(),
    scanWorkspace: vi.fn(),
    previewCreateConfig: vi.fn(),
    createConfig: vi.fn(),
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

    await waitFor(() => screen.getByText('Ready to edit'));
    expect(loadConfig).toHaveBeenCalledWith('1');
  });

  it('disables editing for missing entries and shows recovery actions', async () => {
    const { listWorkspaceConfigs } = await import('../../web/src/api/workspace.js');
    vi.mocked(listWorkspaceConfigs).mockResolvedValue([
      { id: '2', path: '/beta/.planning/config.json', name: 'beta/config.json', status: 'missing', problem: 'Config file not found' },
    ]);

    renderWeb(<App connected />);

    await waitFor(() => screen.getByText('beta/config.json'));
    const button = screen.getByText('beta/config.json').closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
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

describe('add menu', () => {
  it('offers file picker, absolute path, and scan options; create is separate', async () => {
    const { listWorkspaceConfigs } = await import('../../web/src/api/workspace.js');
    vi.mocked(listWorkspaceConfigs).mockResolvedValue([]);

    renderWeb(<App connected />);

    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create new config' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('menuitem', { name: 'File picker' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Absolute path' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Scan chosen folder' })).toBeTruthy();
  });

  it('never submits fake browser paths; routes to path entry', async () => {
    const { listWorkspaceConfigs, trackWorkspace } = await import('../../web/src/api/workspace.js');
    vi.mocked(listWorkspaceConfigs).mockResolvedValue([]);
    vi.mocked(trackWorkspace).mockResolvedValue({
      id: '3',
      path: '/delta/.planning/config.json',
      name: 'delta/config.json',
      status: 'ok',
    });

    renderWeb(<App connected />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'File picker' }));

    expect(screen.getByText(/Browsers hide the real file path/i)).toBeTruthy();

    const input = screen.getByPlaceholderText('/home/projects/my-project/.planning/config.json');
    fireEvent.change(input, { target: { value: '/delta/.planning/config.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add config' }));

    await waitFor(() => {
      expect(trackWorkspace).toHaveBeenCalledWith('/delta/.planning/config.json');
    });
  });

  it('absolute path entry calls trackWorkspace and refreshes sidebar', async () => {
    const { listWorkspaceConfigs, trackWorkspace } = await import('../../web/src/api/workspace.js');
    vi.mocked(listWorkspaceConfigs).mockResolvedValue([]);
    vi.mocked(trackWorkspace).mockResolvedValue({
      id: '4',
      path: '/epsilon/.planning/config.json',
      name: 'epsilon/config.json',
      status: 'ok',
    });

    renderWeb(<App connected />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Absolute path' }));

    const input = screen.getByPlaceholderText('/home/projects/my-project/.planning/config.json');
    fireEvent.change(input, { target: { value: '/epsilon/.planning/config.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add config' }));

    await waitFor(() => {
      expect(trackWorkspace).toHaveBeenCalledWith('/epsilon/.planning/config.json');
    });
  });
});

describe('scan', () => {
  it('shows scan review dialog with candidates and only tracks confirmed selections', async () => {
    const { listWorkspaceConfigs, scanWorkspace, trackWorkspace } = await import('../../web/src/api/workspace.js');
    vi.mocked(listWorkspaceConfigs).mockResolvedValue([]);
    vi.mocked(scanWorkspace).mockResolvedValue([
      { projectName: 'alpha', path: '/alpha/.planning/config.json', status: 'new' },
      { projectName: 'beta', path: '/beta/.planning/config.json', status: 'tracked' },
      { projectName: 'gamma', path: '/gamma/.planning/config.json', status: 'new' },
    ]);
    vi.mocked(trackWorkspace).mockResolvedValue({
      id: '5',
      path: '/alpha/.planning/config.json',
      name: 'alpha/config.json',
      status: 'ok',
    });

    renderWeb(<App connected />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Scan chosen folder' }));

    const input = screen.getByPlaceholderText('/home/projects/my-project/.planning/config.json');
    fireEvent.change(input, { target: { value: '/projects' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }));

    await waitFor(() => {
      expect(scanWorkspace).toHaveBeenCalledWith('/projects');
    });

    expect(screen.getByText('alpha')).toBeTruthy();
    expect(screen.getByText('beta')).toBeTruthy();
    expect(screen.getByText('gamma')).toBeTruthy();

    const trackedCheckbox = screen.getByLabelText(/beta — already tracked/i) as HTMLInputElement;
    expect(trackedCheckbox.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText(/gamma/i));
    fireEvent.click(screen.getByRole('button', { name: 'Add selected' }));

    await waitFor(() => {
      expect(trackWorkspace).toHaveBeenCalledWith('/alpha/.planning/config.json');
      expect(trackWorkspace).not.toHaveBeenCalledWith('/gamma/.planning/config.json');
      expect(trackWorkspace).not.toHaveBeenCalledWith('/beta/.planning/config.json');
    });
  });
});

describe('create', () => {
  it('previews target path, warns if exists, and requires confirmation', async () => {
    const { listWorkspaceConfigs, previewCreateConfig, createConfig } = await import('../../web/src/api/workspace.js');
    vi.mocked(listWorkspaceConfigs).mockResolvedValue([]);
    vi.mocked(previewCreateConfig).mockResolvedValue({
      targetPath: '/zeta/.planning/config.json',
      exists: true,
    });
    vi.mocked(createConfig).mockResolvedValue({
      id: '6',
      path: '/zeta/.planning/config.json',
      name: 'zeta/config.json',
      status: 'ok',
    });

    renderWeb(<App connected />);

    fireEvent.click(screen.getByRole('button', { name: 'Create new config' }));

    const input = screen.getByPlaceholderText('/home/projects/my-project');
    fireEvent.change(input, { target: { value: '/zeta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview target path' }));

    await waitFor(() => {
      expect(previewCreateConfig).toHaveBeenCalledWith('/zeta');
    });

    expect(screen.getByText(/A config already exists/i)).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/I understand/i));
    fireEvent.click(screen.getByRole('button', { name: 'Create config' }));

    await waitFor(() => {
      expect(createConfig).toHaveBeenCalledWith('/zeta', true);
    });
  });
});
