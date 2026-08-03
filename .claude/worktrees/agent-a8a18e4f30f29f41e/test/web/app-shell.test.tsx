// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, fireEvent, render } from '@testing-library/react';
import { AppShell } from '../../web/src/components/AppShell';
import { App } from '../../web/src/App';
import { renderWeb } from './render-helpers';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('AppShell', () => {
  it('renders three pane landmarks and toggle controls', () => {
    render(
      <AppShell
        sidebar={<div>Sidebar content</div>}
        chapterNav={<div>Chapter content</div>}
        editor={<div>Editor content</div>}
        leftOpen={true}
        middleOpen={true}
        onToggleLeft={vi.fn()}
        onToggleMiddle={vi.fn()}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Tracked configurations')).toBeTruthy();
    expect(screen.getByLabelText('Chapters')).toBeTruthy();
    expect(screen.getByLabelText('Editor')).toBeTruthy();
    expect(screen.getByText('Sidebar content')).toBeTruthy();
    expect(screen.getByText('Chapter content')).toBeTruthy();
    expect(screen.getByText('Editor content')).toBeTruthy();
  });

  it('calls toggle handlers when rail buttons are clicked', () => {
    const onToggleLeft = vi.fn();
    const onToggleMiddle = vi.fn();
    render(
      <AppShell
        sidebar={<div>Sidebar</div>}
        chapterNav={<div>Chapters</div>}
        editor={<div>Editor</div>}
        leftOpen={true}
        middleOpen={true}
        onToggleLeft={onToggleLeft}
        onToggleMiddle={onToggleMiddle}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse tracked configs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse chapters' }));

    expect(onToggleLeft).toHaveBeenCalledOnce();
    expect(onToggleMiddle).toHaveBeenCalledOnce();
  });

  it('shows the editor empty state when no config is selected', () => {
    renderWeb(<App connected />);

    expect(screen.getByLabelText('Tracked configurations')).toBeTruthy();
    expect(screen.getByLabelText('Chapters')).toBeTruthy();
    expect(screen.getByLabelText('Editor')).toBeTruthy();
    expect(screen.getByText('Select a configuration')).toBeTruthy();
  });
});
