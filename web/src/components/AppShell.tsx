import type { ReactNode } from 'react';
import { SchemaStatusControl } from './schema/SchemaStatusControl';

export interface AppShellProps {
  /** Left pane: tracked-config sidebar. */
  sidebar: ReactNode;
  /** Middle pane: chapter/category navigation. */
  chapterNav: ReactNode;
  /** Main pane surface. */
  editor: ReactNode;
  /** Dedicated workspace mode controls chapter/search visibility and landmark name. */
  mode?: 'editor' | 'history' | 'schema';
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

function SidebarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function ChaptersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

export function AppShell({
  sidebar,
  chapterNav,
  editor,
  mode = 'editor',
  leftOpen,
  middleOpen,
  onToggleLeft,
  onToggleMiddle,
  searchQuery,
  onSearchQueryChange,
}: AppShellProps) {
  return (
    <div className="gsd-app-shell" data-left-open={leftOpen} data-middle-open={middleOpen}>
      <div className="gsd-app-shell__rail" aria-label="Pane controls">
        <button
          type="button"
          className="gsd-rail-button"
          onClick={onToggleLeft}
          aria-pressed={leftOpen}
          aria-label={leftOpen ? 'Collapse tracked configs' : 'Show tracked configs'}
          title={leftOpen ? 'Collapse tracked configs' : 'Show tracked configs'}
        >
          <SidebarIcon />
        </button>
        <SchemaStatusControl />
        {mode === 'editor' && <button
          type="button"
          className="gsd-rail-button"
          onClick={onToggleMiddle}
          aria-pressed={middleOpen}
          aria-label={middleOpen ? 'Collapse chapters' : 'Show chapters'}
          title={middleOpen ? 'Collapse chapters' : 'Show chapters'}
        >
          <ChaptersIcon />
        </button>}
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
          {editor}
        </div>
      </main>
    </div>
  );
}
