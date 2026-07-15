// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWeb } from './render-helpers';
import { App } from '../../web/src/App';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('launch token bootstrap', () => {
  it('renders the shell, strips the token, and never writes browser storage', async () => {
    window.history.replaceState({}, '', '/?t=one-time-token');
    const localStorageSet = vi.spyOn(Storage.prototype, 'setItem');
    const sessionStorageSet = vi.spyOn(Storage.prototype, 'setItem');
    vi.resetModules();

    const { consumeLaunchToken, getLaunchToken } = await import('../../web/src/bootstrap/token');
    const token = consumeLaunchToken();
    renderWeb(<App connected={token !== null} />);

    expect(screen.getByRole('heading', { name: 'GSD Config Manager' })).toBeTruthy();
    expect(window.location.search).toBe('');
    expect(getLaunchToken()).toBe('one-time-token');
    expect(localStorageSet).not.toHaveBeenCalled();
    expect(sessionStorageSet).not.toHaveBeenCalled();
  });
});