// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StructuredPoolEditor } from '../../web/src/components/specialized/StructuredPoolEditor';

afterEach(() => {
  cleanup();
});

describe('StructuredPoolEditor', () => {
  it('renders descriptor fields and required status', () => {
    render(<StructuredPoolEditor descriptor={{ path: 'ship.pr_body_sections', editor: 'structured-array', editable: true, sensitive: false, sourceEvidence: [], fields: [{ path: 'heading', type: 'string', required: true }] }} value={{ heading: '' }} onChange={() => undefined} />);
    expect(screen.getByLabelText('heading')).toBeTruthy();
    expect(screen.getByText('heading is required.')).toBeTruthy();
  });

  it('renders a validated dropdown for a scalar-leaf entry with allowedValues', () => {
    const onChange = vi.fn();
    render(<StructuredPoolEditor descriptor={{ path: 'granularities', editor: 'runtime-tier-map', editable: true, sensitive: false, sourceEvidence: [], allowedValues: ['coarse', 'standard', 'fine'] }} value="standard" onChange={onChange} />);
    const select = screen.getByLabelText('granularities') as HTMLSelectElement;
    expect(select.value).toBe('standard');
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['coarse', 'standard', 'fine']);
    fireEvent.change(select, { target: { value: 'fine' } });
    expect(onChange).toHaveBeenCalledWith('fine');
  });

  it('renders a plain input for a scalar-leaf entry without allowedValues', () => {
    render(<StructuredPoolEditor descriptor={{ path: 'review.models', editor: 'runtime-tier-map', editable: true, sensitive: false, sourceEvidence: [] }} value="claude-sonnet-4" onChange={() => undefined} />);
    const input = screen.getByLabelText('review.models') as HTMLInputElement;
    expect(input.value).toBe('claude-sonnet-4');
  });

  it('keeps object leaves read-only instead of offering a destructive text input', () => {
    render(<StructuredPoolEditor descriptor={{ path: 'model_profile_overrides', editor: 'runtime-tier-map', editable: true, sensitive: false, sourceEvidence: [] }} value={{ model: 'gpt-5', reasoning_effort: 'high' }} onChange={() => undefined} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText(/nested value with no confirmed per-field editor/)).toBeTruthy();
  });
});
