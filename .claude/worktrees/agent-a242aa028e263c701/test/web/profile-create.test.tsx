// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProfileCards } from '../../web/src/components/specialized/ProfileCards';

describe('profile creation', () => {
  it('copies the selected built-in assignment set without creating a durable identity', () => {
    const onCreate = vi.fn();
    render(<ProfileCards value="quality" onSelect={() => undefined} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create custom project configuration' }));
    expect(onCreate).toHaveBeenCalledWith('quality');
    expect(screen.getByText(/not a reusable named GSD profile/i)).toBeTruthy();
  });
});
