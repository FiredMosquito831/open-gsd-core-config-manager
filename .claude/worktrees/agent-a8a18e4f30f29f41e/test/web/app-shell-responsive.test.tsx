// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from '../../web/src/components/AppShell';

function renderShell() {
  const onToggleLeft = vi.fn();
  const onToggleMiddle = vi.fn();
  render(
    <AppShell
      sidebar={<div>Tracked configs content</div>}
      chapterNav={<div>Chapter nav content</div>}
      editor={<div>Editor surface</div>}
      leftOpen={true}
      middleOpen={true}
      onToggleLeft={onToggleLeft}
      onToggleMiddle={onToggleMiddle}
      searchQuery=""
      onSearchQueryChange={vi.fn()}
    />,
  );
  return { onToggleLeft, onToggleMiddle };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AppShell responsive behavior', () => {
  it('keeps independent rail controls for tracked configs and chapters', () => {
    const { onToggleLeft, onToggleMiddle } = renderShell();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse tracked configs' }));
    expect(onToggleLeft).toHaveBeenCalledOnce();
    expect(onToggleMiddle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse chapters' }));
    expect(onToggleLeft).toHaveBeenCalledOnce();
    expect(onToggleMiddle).toHaveBeenCalledOnce();
  });

  it('renders the search affordance in the editor pane without displacing pane landmarks', () => {
    renderShell();

    expect(screen.getByLabelText('Tracked configurations')).toBeTruthy();
    expect(screen.getByLabelText('Chapters')).toBeTruthy();
    expect(screen.getByLabelText('Editor')).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: /search settings/i })).toBeTruthy();
  });
});
