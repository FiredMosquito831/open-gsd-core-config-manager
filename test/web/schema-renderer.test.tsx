// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
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

async function renderWithActiveConfig() {
  const { listWorkspaceConfigs } = await import('../../web/src/api/workspace.js');
  const { getSchema } = await import('../../web/src/api/schema.js');
  const { loadConfig } = await import('../../web/src/api/configs.js');

  vi.mocked(listWorkspaceConfigs).mockResolvedValue([
    { id: 'cfg-1', path: '/p/.planning/config.json', name: 'p/config.json', status: 'ok' },
  ]);
  vi.mocked(getSchema).mockResolvedValue(testSchema);
  vi.mocked(loadConfig).mockResolvedValue({
    raw: { project: {}, global: null },
    effective: {
      workflow: {
        tdd_mode: { path: 'workflow.tdd_mode', value: true, from: 'canonical' },
      },
      mode: { path: 'mode', value: 'interactive', from: 'canonical' },
      review: {
        strategy: { path: 'review.strategy', value: 'strict', from: 'canonical' },
      },
    },
    unknown: [],
    meta: { globalDefaultsPath: '', globalDefaultsFound: false },
  });

  renderWeb(<App connected />);
  await waitFor(() => screen.getByText('p/config.json'));
  fireEvent.click(screen.getByText('p/config.json'));
  await waitFor(() => screen.getByRole('tab', { name: 'Core' }));
}

describe('schema renderer', () => {
  it('renders schema-derived categories as chapter tabs', async () => {
    await renderWithActiveConfig();
    expect(screen.getByRole('tab', { name: 'Workflow' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Core' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Review' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Model & Routing' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Ship' })).toBeTruthy();
  });

  it('shows the fields for the selected chapter in the editor pane', async () => {
    await renderWithActiveConfig();
    fireEvent.click(screen.getByRole('tab', { name: 'Workflow' }));
    await waitFor(() => {
      expect(screen.getByTestId('field-workflow.tdd_mode')).toBeTruthy();
    });
  });

  it('covers every schema key without omission', async () => {
    await renderWithActiveConfig();
    const categories = ['Core', 'Workflow', 'Review', 'Model & Routing', 'Ship'];
    const renderedPaths = new Set<string>();

    for (const category of categories) {
      fireEvent.click(screen.getByRole('tab', { name: category }));
      await waitFor(() => screen.getByTestId(new RegExp('^(field|handoff)-')));
      const cards = screen.getAllByTestId(/^field-|^handoff-/);
      cards.forEach((card) => {
        const match = card.getAttribute('data-testid')?.match(/^(?:field|handoff)-(.+)$/);
        if (match) renderedPaths.add(match[1]);
      });
    }

    const expectedPaths = Object.keys(testSchema).sort();
    expect(Array.from(renderedPaths).sort()).toEqual(expectedPaths);
  });

  it('marks array/object/dynamic-map entries as handoff cards', async () => {
    await renderWithActiveConfig();

    fireEvent.click(screen.getByRole('tab', { name: 'Ship' }));
    await waitFor(() => screen.getByTestId('handoff-ship.pr_body_sections'));
    expect(screen.getByTestId('handoff-ship.pr_body_sections')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Model & Routing' }));
    await waitFor(() => screen.getByTestId('handoff-model_overrides'));
    expect(screen.getByTestId('handoff-model_overrides')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Core' }));
    await waitFor(() => screen.getByTestId('field-mode'));
    expect(screen.queryByTestId('handoff-mode')).toBeNull();
  });

  it('selects the first chapter automatically when a config loads', async () => {
    await renderWithActiveConfig();
    await waitFor(() => {
      expect(screen.getByTestId('field-mode')).toBeTruthy();
    });
  });
});
