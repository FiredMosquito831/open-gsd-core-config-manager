// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);
import { RuntimeInstallNotice } from '../../web/src/components/specialized/RuntimeInstallNotice';

describe('RuntimeInstallNotice', () => {
  it('names only the changed setting and the exact runtime install command', () => {
    render(<RuntimeInstallNotice runtime="codex" settings={['model_profile_overrides.codex.sonnet']} onDismiss={() => undefined} />);
    expect(screen.getByText(/model_profile_overrides\.codex\.sonnet/)).toBeTruthy();
    expect(screen.getByText('gsd install codex')).toBeTruthy();
    expect(screen.queryByText(/gpt|secret|token|warning/i)).toBeNull();
  });

  it('can be dismissed explicitly', () => {
    const onDismiss = vi.fn();
    render(<RuntimeInstallNotice runtime="opencode" settings={['model_profile_overrides.opencode.sonnet']} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss install guidance' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
