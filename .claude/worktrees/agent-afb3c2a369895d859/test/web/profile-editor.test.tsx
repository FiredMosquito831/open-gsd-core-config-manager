// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileEditor } from '../../web/src/components/specialized/ProfileEditor';

describe('ProfileEditor', () => {
  it('keeps the session label visibly local and edits ordinary project fields', () => {
    render(<ProfileEditor assignments={{ 'gsd-executor': 'sonnet' }} sessionLabel="Sprint" onSessionLabelChange={() => undefined} onChange={() => undefined} onBack={() => undefined} />);
    expect(screen.getByLabelText('Session label (optional)')).toBeTruthy();
    expect(screen.getByText(/never serialized/i)).toBeTruthy();
    expect(screen.getByText('gsd-executor')).toBeTruthy();
    expect(screen.queryByText('profile id')).toBeNull();
  });
});
