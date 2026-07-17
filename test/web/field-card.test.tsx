// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWeb } from './render-helpers';
import { App } from '../../web/src/App';
import { useUiStore } from '../../web/src/state/uiStore.js';
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
  'review.strategy': {
    type: 'string',
    enum: ['strict', 'loose'],
    title: 'Review Strategy',
    'x-category': 'Review',
    'x-description': 'How thoroughly to review changes.',
    'x-provenance': 'config-defaults',
  },
  'workflow.max_discuss_passes': {
    type: 'integer',
    title: 'Max Discuss Passes',
    'x-category': 'Workflow',
    'x-description': 'Maximum discuss-phase passes before escalation.',
    'x-provenance': 'config-defaults',
  },
  model_overrides: {
    type: 'object',
    title: 'Model Overrides',
    'x-category': 'Model & Routing',
    'x-description': 'Per-agent model overrides.',
    'x-provenance': 'dynamicKeyPattern:model_overrides',
    patternProperties: {
      '^model_overrides\\.[a-zA-Z0-9_-]+$': {
        type: 'string',
        title: 'Model override',
        'x-category': 'Model & Routing',
        'x-description': 'Model for this agent.',
        'x-provenance': 'dynamicKeyPattern:model_overrides',
      },
    },
    'x-dynamic-key-hint': 'agent-id',
  },
  'ship.pr_body_sections': {
    type: 'array',
    title: 'PR Body Sections',
    'x-category': 'Ship',
    'x-description': 'Sections to include in PR body.',
    'x-provenance': 'config-defaults',
  },
};

const loadResult: LoadResult = {
  raw: { project: { mode: 'autonomous' }, global: null },
  effective: {
    workflow: {
      tdd_mode: { path: 'workflow.tdd_mode', value: true, from: 'canonical' },
      max_discuss_passes: { path: 'workflow.max_discuss_passes', value: 3, from: 'project' },
    },
    mode: { path: 'mode', value: 'autonomous', from: 'project' },
    review: {
      strategy: { path: 'review.strategy', value: 'strict', from: 'global' },
    },
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

describe('FieldCard', () => {
  it('shows the field description and title', async () => {
    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Core' }));
    await waitFor(() => screen.getByTestId('field-mode'));
    expect(screen.getByText('Mode')).toBeTruthy();
    expect(screen.getByText('Default agent behavior.')).toBeTruthy();
  });

  it('shows provenance label for each field', async () => {
    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Core' }));
    await waitFor(() => screen.getByTestId('field-mode'));
    expect(screen.getByText('Project override')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Workflow' }));
    await waitFor(() => screen.getByTestId('field-workflow.tdd_mode'));
    expect(screen.getByText('Canonical default')).toBeTruthy();
    await waitFor(() => screen.getByText('Project override'));
    expect(screen.getAllByText('Project override').length).toBeGreaterThanOrEqual(1);
  });

  it('offers reset only when the effective value is a project override', async () => {
    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Core' }));
    await waitFor(() => screen.getByTestId('field-mode'));
    expect(screen.getByRole('button', { name: 'Reset project override' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Review' }));
    await waitFor(() => screen.getByTestId('field-review.strategy'));
    expect(screen.queryByRole('button', { name: 'Reset project override' })).toBeNull();
  });

  it('expands to reveal deeper details', async () => {
    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Core' }));
    await waitFor(() => screen.getByTestId('field-mode'));
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    await waitFor(() => screen.getByText('Human-in-the-loop'));
    expect(screen.getByText('Agent decides')).toBeTruthy();
  });

  it('shows a content gap when enum options lack prose', async () => {
    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Review' }));
    await waitFor(() => screen.getByTestId('field-review.strategy'));
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    await waitFor(() => screen.getByText(/Option meanings missing/));
  });
});

describe('EnumCombobox', () => {
  it('renders enum options and restricts to valid values', async () => {
    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Core' }));
    await waitFor(() => screen.getByTestId('field-mode'));
    const select = screen.getByLabelText('Mode') as HTMLSelectElement;
    expect(select.value).toBe('autonomous');
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['interactive', 'autonomous']);
  });

  it('renders a plain input for non-enum scalar types', async () => {
    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Workflow' }));
    await waitFor(() => screen.getByTestId('field-workflow.max_discuss_passes'));
    const input = screen.getByLabelText('Max Discuss Passes') as HTMLInputElement;
    expect(input.type).toBe('number');
  });
});

describe('SpecializedHandoffCard', () => {
  it('renders handoff cards for array, object, and dynamic-map entries', async () => {
    await renderWithActiveConfig();

    fireEvent.click(screen.getByRole('tab', { name: 'Ship' }));
    await waitFor(() => screen.getByTestId('handoff-ship.pr_body_sections'));
    expect(screen.getByText('Phase 4')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Model & Routing' }));
    await waitFor(() => screen.getByTestId('handoff-model_overrides'));
    expect(screen.getByText('agent-id')).toBeTruthy();
  });

  it('does not render raw JSON textareas for handoff entries', async () => {
    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Ship' }));
    await waitFor(() => screen.getByTestId('handoff-ship.pr_body_sections'));
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
