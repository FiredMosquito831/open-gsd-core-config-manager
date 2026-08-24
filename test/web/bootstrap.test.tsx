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

describe('app bootstrap', () => {
  it('renders the full shell on a plain launch with no token in the URL', async () => {
    window.history.replaceState({}, '', '/');
    renderWeb(<App />);

    expect(screen.getByText('Select a configuration')).toBeTruthy();
    expect(screen.getByLabelText('Tracked configurations')).toBeTruthy();
    expect(screen.getByLabelText('Chapters')).toBeTruthy();
    expect(screen.getByLabelText('Editor')).toBeTruthy();
    expect(window.location.search).toBe('');
  });
});
