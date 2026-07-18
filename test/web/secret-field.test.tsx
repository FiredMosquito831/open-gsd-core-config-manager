// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

// Timer-driven remasking is asserted inside act so React flushes the state update.
import { SecretField } from '../../web/src/components/specialized/SecretField';

afterEach(() => cleanup());

describe('SecretField', () => {
  it('masks by default and reveals only after an explicit action', () => {
    render(<SecretField id="api-key" label="API key" value="sentinel-secret" onChange={vi.fn()} />);
    const input = screen.getByLabelText('API key');
    expect(input.getAttribute('type')).toBe('password');
    expect((input as HTMLInputElement).value).toBe('sentinel-secret');

    fireEvent.click(screen.getByRole('button', { name: 'Reveal value' }));
    expect(input.getAttribute('type')).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide value' })).toBeTruthy();
  });

  it('remasks on blur and after inactivity', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SecretField id="api-key" label="API key" value="sentinel-secret" onChange={onChange} />);
    const input = screen.getByLabelText('API key');
    fireEvent.click(screen.getByRole('button', { name: 'Reveal value' }));
    expect(input.getAttribute('type')).toBe('text');
    fireEvent.blur(input);
    expect(input.getAttribute('type')).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Reveal value' }));
    act(() => vi.advanceTimersByTime(15_001));
    expect(input.getAttribute('type')).toBe('password');
    expect(onChange).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
