// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWeb } from './render-helpers';
import { App } from '../../web/src/App';
import { useUiStore } from '../../web/src/state/uiStore.js';
import type { SchemaEntry } from '../../packages/config-io/src/types.js';

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

const testSchema: Record<string, SchemaEntry> = {
  'workflow.tdd_mode': {
    type: 'boolean',
    title: 'TDD Mode',
    'x-category': 'Workflow',
    'x-description': 'Require testing before implementation for behavior-changing work.',
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
      interactive: { 'x-description': 'Ask the human before major decisions.' },
      autonomous: { 'x-description': 'Agent decides without routine prompts.' },
    },
  },
  'review.strategy': {
    type: 'string',
    enum: ['strict', 'loose'],
    title: 'Review Strategy',
    'x-category': 'Review',
    'x-description': 'How thoroughly to review changes.',
    'x-provenance': 'config-defaults',
  },
};

function resetStore() {
  useUiStore.setState({
    activeConfigId: null,
    activeChapter: null,
    leftPaneOpen: true,
    middlePaneOpen: true,
    searchQuery: '',
    searchOpen: false,
    highlightTarget: null,
  });
}

async function renderWithActiveConfig() {
  const { listWorkspaceConfigs } = await import('../../web/src/api/workspace.js');
  const { getSchema } = await import('../../web/src/api/schema.js');
  const { loadConfig } = await import('../../web/src/api/configs.js');

  vi.mocked(listWorkspaceConfigs).mockResolvedValue([
    { id: 'cfg-1', path: '/p/.planning/config.json', name: 'p/config.json', status: 'ok' },
  ]);
  vi.mocked(getSchema).mockResolvedValue(testSchema);
  vi.mocked(loadConfig).mockResolvedValue({
    raw: {
      project: {
        mode: 'interactive',
        workflow: { tdd_mode: false, x_future_toggle: '<img src=x onerror=alert(1)>' },
      },
      global: null,
    },
    effective: {
      workflow: {
        tdd_mode: { path: 'workflow.tdd_mode', value: false, from: 'project' },
        x_future_toggle: {
          path: 'workflow.x_future_toggle',
          value: '<img src=x onerror=alert(1)>',
          from: 'project',
        },
      },
      mode: { path: 'mode', value: 'interactive', from: 'project' },
      review: {
        strategy: { path: 'review.strategy', value: 'strict', from: 'canonical' },
      },
    },
    unknown: [
      {
        path: 'workflow.x_future_toggle',
        value: '<img src=x onerror=alert(1)>',
        presentIn: ['project'],
      },
    ],
    meta: { globalDefaultsPath: '', globalDefaultsFound: false },
  });

  renderWeb(<App connected />);
  await waitFor(() => screen.getByText('p/config.json'));
  fireEvent.click(screen.getByText('p/config.json'));
  await waitFor(() => screen.getByRole('tab', { name: 'Core' }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetStore();
  window.history.replaceState({}, '', '/');
});

describe('global search', () => {
  it('replaces the chapter editor with grouped results and finds prose wording', async () => {
    await renderWithActiveConfig();

    fireEvent.change(screen.getByRole('searchbox', { name: /search settings/i }), {
      target: { value: 'testing before implementation' },
    });

    await waitFor(() => screen.getByRole('heading', { name: /search results/i }));
    expect(screen.queryByRole('heading', { name: 'Core' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Workflow' })).toBeTruthy();
    expect(screen.getByText('workflow.tdd_mode')).toBeTruthy();
    expect(screen.getByText('Require')).toBeTruthy();
    expect(screen.getByText('testing before implementation')).toBeTruthy();
  });

  it('matches enum option meanings but not current values by default', async () => {
    await renderWithActiveConfig();

    fireEvent.change(screen.getByRole('searchbox', { name: /search settings/i }), {
      target: { value: 'human before major decisions' },
    });

    await waitFor(() => screen.getByRole('heading', { name: /search results/i }));
    expect(screen.getByText('mode')).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox', { name: /search settings/i }), {
      target: { value: 'strict' },
    });

    await waitFor(() => expect(screen.getAllByText(/No settings match/i).length).toBeGreaterThan(0));
    expect(screen.queryByText('review.strategy')).toBeNull();
  });

  it('selecting a result restores the chapter, focuses and highlights the field, and keeps the query', async () => {
    await renderWithActiveConfig();

    fireEvent.change(screen.getByRole('searchbox', { name: /search settings/i }), {
      target: { value: 'workflow.tdd_mode' },
    });
    await waitFor(() => screen.getByRole('heading', { name: /search results/i }));

    fireEvent.click(screen.getByRole('button', { name: /open workflow.tdd_mode/i }));

    await waitFor(() => screen.getByTestId('field-workflow.tdd_mode'));
    expect((screen.getByRole('searchbox', { name: /search settings/i }) as HTMLInputElement).value).toBe('workflow.tdd_mode');
    expect(screen.getByTestId('field-workflow.tdd_mode').className).toContain('gsd-field-card--highlighted');
    expect(document.activeElement).toBe(screen.getByTestId('field-workflow.tdd_mode'));
  });
});


describe('unknown key chapter', () => {
  it('shows read-only unknown keys in an Unrecognized chapter with safe value text', async () => {
    await renderWithActiveConfig();

    fireEvent.click(screen.getByRole('tab', { name: 'Unrecognized' }));

    await waitFor(() => screen.getByTestId('unknown-workflow.x_future_toggle'));
    expect(screen.getByText('workflow.x_future_toggle')).toBeTruthy();
    expect(screen.getByText('project')).toBeTruthy();
    expect(screen.getByText('string')).toBeTruthy();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(/schema cannot document or guide this key/i)).toBeTruthy();
    expect(screen.getByText(/read-only in phase 3/i)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /workflow.x_future_toggle/i })).toBeNull();
  });

  it('preserves unknown project keys in the save candidate after editing a known key', async () => {
    const { saveConfig } = await import('../../web/src/api/configs.js');
    vi.mocked(saveConfig).mockResolvedValue({ snapshotId: 'snap-1' });
    await renderWithActiveConfig();

    fireEvent.click(screen.getByRole('tab', { name: 'Workflow' }));
    await waitFor(() => screen.getByTestId('field-workflow.tdd_mode'));
    fireEvent.click(screen.getByLabelText('TDD Mode'));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(saveConfig).toHaveBeenCalled());
    const candidate = vi.mocked(saveConfig).mock.calls[0][1] as { workflow?: Record<string, unknown> };
    expect(candidate.workflow?.x_future_toggle).toBe('<img src=x onerror=alert(1)>');
  });
});
