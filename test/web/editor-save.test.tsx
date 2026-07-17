// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWeb } from './render-helpers';
import { App } from '../../web/src/App';
import { useUiStore } from '../../web/src/state/uiStore.js';
import { ApiError } from '../../web/src/api/client.js';
import type { SchemaEntry, LoadResult } from '../../packages/config-io/src/types.js';

vi.mock('../../web/src/api/workspace.js', async () => {
  const actual = await vi.importActual('../../web/src/api/workspace.js') as object;
  return {
    ...actual,
    listWorkspaceConfigs: vi.fn(),
  };
});

vi.mock('../../web/src/api/schema.js', async () => {
  const actual = await vi.importActual('../../web/src/api/schema.js') as object;
  return {
    ...actual,
    getSchema: vi.fn(),
  };
});

vi.mock('../../web/src/api/configs.js', async () => {
  const actual = await vi.importActual('../../web/src/api/configs.js') as object;
  return {
    ...actual,
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useUiStore.setState({
    activeConfigId: null,
    activeChapter: null,
    leftPaneOpen: true,
    middlePaneOpen: true,
    searchQuery: '',
    searchOpen: false,
    highlightTarget: null,
  });
  window.history.replaceState({}, '', '/');
});

const testSchema: Record<string, SchemaEntry> = {
  'workflow.tdd_mode': {
    type: 'boolean',
    title: 'TDD Mode',
    'x-category': 'Workflow',
    'x-description': 'Require tests before implementation.',
    'x-provenance': 'config-defaults',
  },
  mode: {
    type: 'string',
    enum: ['interactive', 'autonomous'],
    title: 'Mode',
    'x-category': 'Core',
    'x-description': 'Default agent behavior.',
    'x-provenance': 'config-defaults',
    'x-options': {
      interactive: { 'x-description': 'Human-in-the-loop' },
      autonomous: { 'x-description': 'Agent decides' },
    },
  },
  'workflow.max_discuss_passes': {
    type: 'integer',
    title: 'Max Discuss Passes',
    'x-category': 'Workflow',
    'x-description': 'Maximum discuss-phase passes before escalation.',
    'x-provenance': 'config-defaults',
  },
};

const loadResult: LoadResult = {
  raw: { project: { mode: 'interactive' }, global: null },
  effective: {
    workflow: {
      tdd_mode: { path: 'workflow.tdd_mode', value: true, from: 'canonical' },
      max_discuss_passes: { path: 'workflow.max_discuss_passes', value: 3, from: 'project' },
    },
    mode: { path: 'mode', value: 'interactive', from: 'project' },
  },
  unknown: [],
  meta: { globalDefaultsPath: '', globalDefaultsFound: false },
};

async function renderWithActiveConfig() {
  const { listWorkspaceConfigs } = await import('../../web/src/api/workspace.js');
  const { getSchema } = await import('../../web/src/api/schema.js');
  const { loadConfig } = await import('../../web/src/api/configs.js');

  vi.mocked(listWorkspaceConfigs).mockResolvedValue([
    { id: 'cfg-1', path: '/p/.planning/config.json', name: 'p/config.json', status: 'ok' },
  ]);
  vi.mocked(getSchema).mockResolvedValue(testSchema);
  vi.mocked(loadConfig).mockResolvedValue(loadResult);

  renderWeb(<App connected />);
  await waitFor(() => screen.getByText('p/config.json'));
  fireEvent.click(screen.getByText('p/config.json'));
  await waitFor(() => screen.getByRole('tab', { name: 'Core' }));
}

describe('editor save flow', () => {
  it('does not show premature validation errors on untouched fields', async () => {
    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Workflow' }));
    await waitFor(() => screen.getByTestId('field-workflow.max_discuss_passes'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows inline validation after blur and blocks save while errors remain', async () => {
    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Workflow' }));
    await waitFor(() => screen.getByTestId('field-workflow.max_discuss_passes'));

    const input = screen.getByLabelText('Max Discuss Passes') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3.5' } });
    fireEvent.blur(input);

    await waitFor(() => {
      const alert = screen.queryByRole('alert');
      expect(alert).toBeTruthy();
    });

    const saveButton = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('saves a project candidate built from raw.project plus changes and resets', async () => {
    const { saveConfig } = await import('../../web/src/api/configs.js');
    vi.mocked(saveConfig).mockResolvedValue({ snapshotId: 'snap-1' });

    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Core' }));
    await waitFor(() => screen.getByTestId('field-mode'));

    const select = screen.getByLabelText('Mode') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'autonomous' } });

    fireEvent.click(screen.getByRole('tab', { name: 'Workflow' }));
    await waitFor(() => screen.getByTestId('field-workflow.max_discuss_passes'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset project override' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(saveConfig).toHaveBeenCalledWith(
        'cfg-1',
        expect.objectContaining({ mode: 'autonomous' }),
      );
    });

    const candidate = vi.mocked(saveConfig).mock.calls[0][1];
    expect(candidate).not.toHaveProperty('workflow.max_discuss_passes');
    expect(candidate).toEqual({ mode: 'autonomous' });
  });

  it('renders server 422 validation errors in the validation summary without claiming success', async () => {
    const { saveConfig } = await import('../../web/src/api/configs.js');
    vi.mocked(saveConfig).mockRejectedValue(
      new ApiError([
        {
          message: 'must be integer',
          instancePath: '/workflow/max_discuss_passes',
          keyword: 'type',
        },
      ]),
    );

    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Workflow' }));
    await waitFor(() => screen.getByTestId('field-workflow.max_discuss_passes'));

    const input = screen.getByLabelText('Max Discuss Passes') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(screen.getByText(/must be integer/i)).toBeTruthy();
      expect(screen.getAllByText(/workflow.max_discuss_passes/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText(/Saved successfully/i)).toBeNull();
  });

  it('refetches the config after a successful save so provenance updates', async () => {
    const { saveConfig } = await import('../../web/src/api/configs.js');
    const { loadConfig } = await import('../../web/src/api/configs.js');
    vi.mocked(saveConfig).mockResolvedValue({ snapshotId: 'snap-2' });

    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Core' }));
    await waitFor(() => screen.getByTestId('field-mode'));

    const select = screen.getByLabelText('Mode') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'autonomous' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(vi.mocked(loadConfig).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
