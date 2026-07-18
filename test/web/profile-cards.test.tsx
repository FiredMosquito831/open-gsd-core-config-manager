// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileCards } from '../../web/src/components/specialized/ProfileCards';

describe('ProfileCards', () => {
  it('renders every catalogued built-in choice and copy-first CTA', () => {
    render(<ProfileCards value="balanced" onSelect={() => undefined} onCreate={() => undefined} />);
    for (const name of ['quality', 'balanced', 'budget', 'adaptive', 'inherit']) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create custom project configuration' })).toBeTruthy();
  });
});
