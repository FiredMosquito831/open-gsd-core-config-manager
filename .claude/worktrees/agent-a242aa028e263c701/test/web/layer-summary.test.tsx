// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

afterEach(() => cleanup());
import { LayerSummary } from '../../web/src/components/specialized/LayerSummary';

describe('LayerSummary', () => {
  const layers = {
    canonical: 'claude-3-5-haiku',
    global: { provider: 'anthropic', model: 'global-model' },
    project: 'project-model',
  };

  it('shows all layers, effective source, and the project-scope explanation', () => {
    render(<LayerSummary layers={layers} effectiveSource="global" />);

    expect(screen.getByText('Canonical default')).toBeTruthy();
    expect(screen.getByText('Global default')).toBeTruthy();
    expect(screen.getByText('Project override')).toBeTruthy();
    expect(screen.getByText('Effective')).toBeTruthy();
    expect(screen.getByText(/Editing it will create a project override/)).toBeTruthy();
  });

  it('expands long layer values without using raw HTML', () => {
    render(
      <LayerSummary
        layers={{ canonical: '<b>safe</b>', global: null, project: 'project' }}
        effectiveSource="canonical"
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Canonical default/i })[0]);
    expect(screen.getByText('<b>safe</b>')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Canonical default/i })[0].getAttribute('aria-expanded')).toBe('true');
  });
});
