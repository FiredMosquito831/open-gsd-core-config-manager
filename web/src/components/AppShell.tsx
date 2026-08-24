import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { SchemaStatusControl } from './schema/SchemaStatusControl';
import { ApiKeysStatusControl } from './keys/ApiKeysStatusControl';
import { ApiKeysWorkspace } from './keys/ApiKeysWorkspace';
import { ThemeToggle } from './common/ThemeToggle';
import { Icons, Icon } from './common/Icons';
import { useUiStore } from '../state/uiStore';

export interface AppShellProps {
  /** Left pane: tracked-config sidebar. */
  sidebar: ReactNode;
  /** Middle pane: chapter/category navigation. */
  chapterNav: ReactNode;
  /** Main pane surface. */
  editor: ReactNode;
  /**
   * Persistent workspace context header rendered at the main-pane top.
   * Owned by the App layer (it reads react-query / the store); AppShell just
   * places it so the shell stays free of data dependencies and unit-testable.
   */
  workspaceHeader?: ReactNode;
  /** Dedicated workspace mode controls chapter/search visibility and landmark name. */
  mode?: 'editor' | 'history' | 'schema' | 'keys';
  /** Whether the left sidebar pane is currently open. */
  leftOpen: boolean;
  /** Whether the middle chapter pane is currently open. */
  middleOpen: boolean;
  /** Toggle the left pane open/closed. */
  onToggleLeft: () => void;
  /** Toggle the middle pane open/closed. */
  onToggleMiddle: () => void;
  /** Global settings search query. */
  searchQuery: string;
  /** Update the global settings search query. */
  onSearchQueryChange: (query: string) => void;
}

/** Responsive breakpoints (px). */
const COMPACT_MAX = 960;
const MEDIUM_MAX = 1100;

export function AppShell({
  sidebar,
  chapterNav,
  editor,
  workspaceHeader,
  mode = 'editor',
  leftOpen,
  middleOpen,
  onToggleLeft,
  onToggleMiddle,
  searchQuery,
  onSearchQueryChange,
}: AppShellProps) {
  const activeConfigId = useUiStore((state) => state.activeConfigId);

  // Default to a desktop width when the viewport is unknown (0 in jsdom / SSR)
  // so the responsive auto-collapse only engages at a genuinely narrow width.
  const initialVw = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 0;
  const [vw, setVw] = useState<number>(initialVw || 1280);
  // Remember whether the user explicitly toggled a pane, so the responsive
  // auto-collapse only overrides an untouched default (not their choice).
  const userToggled = useRef({ left: false, middle: false });

  useEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const compact = vw <= COMPACT_MAX;
  const medium = vw <= MEDIUM_MAX;

  // <=1100px: auto-collapse the chapter pane unless the user chose otherwise.
  useEffect(() => {
    if (medium && middleOpen && !userToggled.current.middle) onToggleMiddle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medium]);

  // <=960px: left + chapter are overlay drawers and must be mutually exclusive.
  useEffect(() => {
    if (compact && leftOpen && middleOpen) onToggleMiddle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, leftOpen, middleOpen]);

  // <=960px: picking a config closes the left drawer so the editor shows.
  useEffect(() => {
    if (compact && activeConfigId && leftOpen) onToggleLeft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConfigId]);

  // Lock body scroll while a compact drawer is open.
  useEffect(() => {
    const locked = compact && (leftOpen || middleOpen);
    document.body.classList.toggle('gsd-no-scroll', locked);
    return () => document.body.classList.remove('gsd-no-scroll');
  }, [compact, leftOpen, middleOpen]);

  // Track toggles so auto-collapse stops overriding a deliberate user action.
  const handleToggleLeft = () => {
    userToggled.current.left = true;
    if (compact && middleOpen) onToggleMiddle();
    onToggleLeft();
  };
  const handleToggleMiddle = () => {
    userToggled.current.middle = true;
    if (compact && leftOpen) onToggleLeft();
    onToggleMiddle();
  };

  const closeDrawers = () => {
    if (leftOpen) onToggleLeft();
    if (middleOpen) onToggleMiddle();
  };

  const drawerOpen = compact && (leftOpen || middleOpen);

  return (
    <div className="gsd-app-shell" data-left-open={leftOpen} data-middle-open={middleOpen} data-compact={compact}>
      <div className="gsd-app-shell__rail" aria-label="Pane controls">
        <button
          type="button"
          className="gsd-rail-button"
          onClick={handleToggleLeft}
          aria-pressed={leftOpen}
          aria-label={leftOpen ? 'Collapse tracked configs' : 'Show tracked configs'}
          title={leftOpen ? 'Collapse tracked configs' : 'Show tracked configs'}
        >
          <Icons.sidebar size={16} />
        </button>
        <SchemaStatusControl />
        <ApiKeysStatusControl />
        {mode === 'editor' && <button
          type="button"
          className="gsd-rail-button"
          onClick={handleToggleMiddle}
          aria-pressed={middleOpen}
          aria-label={middleOpen ? 'Collapse chapters' : 'Show chapters'}
          title={middleOpen ? 'Collapse chapters' : 'Show chapters'}
        >
          <Icons.chapters size={16} />
        </button>}
        <div className="gsd-rail__spacer" aria-hidden="true" />
        <ThemeToggle />
      </div>

      <aside
        className="gsd-app-shell__left"
        aria-label="Tracked configurations"
        aria-hidden={!leftOpen}
      >
        <div className="gsd-app-shell__pane-content">{sidebar}</div>
      </aside>

      {mode === 'editor' && <nav
        className="gsd-app-shell__middle"
        aria-label="Chapters"
        aria-hidden={!middleOpen}
      >
        <div className="gsd-app-shell__pane-content">{chapterNav}</div>
      </nav>}

      <main className="gsd-app-shell__main" aria-label={mode === 'history' ? 'Version history' : mode === 'schema' ? 'Schema maintenance' : 'Editor'}>
        {workspaceHeader}
        <div className="gsd-app-shell__pane-content">
          {mode === 'editor' && <div className="gsd-global-search" role="search">
            <label className="gsd-global-search__label" htmlFor="gsd-global-search-input">
              Search settings
            </label>
            <input
              id="gsd-global-search-input"
              className="gsd-global-search__input"
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search by key, title, explanation, or option meaning"
            />
          </div>}
          {mode === 'keys' ? <ApiKeysWorkspace /> : editor}
        </div>
      </main>

      {drawerOpen && (
        <div
          className="gsd-drawer-backdrop"
          aria-hidden="true"
          onClick={closeDrawers}
          onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeDrawers(); } }}
        />
      )}
    </div>
  );
}
