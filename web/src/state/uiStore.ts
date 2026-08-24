import { create } from 'zustand';
import type { KeyStatusDto } from '../../../packages/server/src/api-types';

/** Theme choices. Dark is the default and needs no document attribute; light is stamped explicitly. */
export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'gsd-theme';

/** Read the persisted theme choice. Returns 'dark' when nothing valid is stored. */
export function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Stamp a theme onto <html> so CSS tokens switch. Dark is the default (no attribute). */
export function applyThemeToDocument(theme: Theme): void {
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }
}

interface UiState {
  activeConfigId: string | null;
  activeChapter: string | null;
  leftPaneOpen: boolean;
  middlePaneOpen: boolean;
  searchQuery: string;
  searchOpen: boolean;
  highlightTarget: string | null;
  focusedPath: string | null;
  focusedOriginChapter: string | null;
  profileEditorOpen: boolean;
  profileSessionLabel: string;
  workspaceMode: 'editor' | 'history' | 'schema' | 'keys';
  selectedHistorySeq: number | null;
  keysStatus: KeyStatusDto[] | null;
  restoreNotice: { configId: string; timestamp: string; warning?: boolean } | null;
  /** Active theme. Dark is default; 'light' is stamped on <html> by setTheme. */
  theme: Theme;
  /**
   * Config ids that carry unsaved edits (parked drafts). Sidebar + save loop
   * use this to render the dirty dot / "Edited" badge. Squad-owned; lead seeds
   * the field so other agents only call the setter.
   */
  dirtyConfigIds: string[];
  setActiveConfigId: (id: string | null) => void;
  openHistory: () => void;
  openSchemaMaintenance: () => void;
  openKeys: () => void;
  setKeysStatus: (keysStatus: KeyStatusDto[] | null) => void;
  backToEditor: () => void;
  selectHistorySnapshot: (seq: number | null) => void;
  showRestoreNotice: (configId: string, timestamp: string, warning?: boolean) => void;
  clearRestoreNotice: () => void;
  setActiveChapter: (chapter: string | null) => void;
  toggleLeftPane: () => void;
  toggleMiddlePane: () => void;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (open: boolean) => void;
  setHighlightTarget: (target: string | null) => void;
  setFocusedPath: (path: string | null, chapter: string | null) => void;
  setProfileEditorOpen: (open: boolean) => void;
  setProfileSessionLabel: (label: string) => void;
  clearHighlight: () => void;
  /** Persist + apply the theme. Stored under THEME_STORAGE_KEY; applied to <html>. */
  setTheme: (theme: Theme) => void;
  /** Replace the dirty-config id set (used by the draft/save loop). */
  setDirtyConfigIds: (ids: string[]) => void;
  /** Open/close the global "Create new config" dialog (shared by the sidebar + the editor empty state). */
  createConfigOpen: boolean;
  setCreateConfigOpen: (open: boolean) => void;
  /** Open/close the shared "Add existing config" file flow (shared by the sidebar + the editor empty state). */
  trackConfigOpen: boolean;
  setTrackConfigOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeConfigId: null,
  activeChapter: null,
  leftPaneOpen: true,
  middlePaneOpen: true,
  searchQuery: '',
  searchOpen: false,
  highlightTarget: null,
  focusedPath: null,
  focusedOriginChapter: null,
  profileEditorOpen: false,
  profileSessionLabel: '',
  workspaceMode: 'editor',
  selectedHistorySeq: null,
  keysStatus: null,
  restoreNotice: null,
  theme: readStoredTheme(),
  dirtyConfigIds: [],
  createConfigOpen: false,
  trackConfigOpen: false,
  setActiveConfigId: (activeConfigId) => set((state) => ({ activeConfigId, focusedPath: null, focusedOriginChapter: null, profileEditorOpen: false, profileSessionLabel: '', selectedHistorySeq: state.workspaceMode === 'history' ? null : state.selectedHistorySeq })),
  openHistory: () => set({ workspaceMode: 'history', selectedHistorySeq: null }),
  openSchemaMaintenance: () => set({ workspaceMode: 'schema' }),
  openKeys: () => set({ workspaceMode: 'keys' }),
  setKeysStatus: (keysStatus) => set({ keysStatus }),
  backToEditor: () => set({ workspaceMode: 'editor' }),
  selectHistorySnapshot: (selectedHistorySeq) => set({ selectedHistorySeq }),
  showRestoreNotice: (configId, timestamp, warning) => set({ restoreNotice: { configId, timestamp, warning } }),
  clearRestoreNotice: () => set({ restoreNotice: null }),
  setActiveChapter: (activeChapter) => set({ activeChapter }),
  toggleLeftPane: () => set((state) => ({ leftPaneOpen: !state.leftPaneOpen })),
  toggleMiddlePane: () => set((state) => ({ middlePaneOpen: !state.middlePaneOpen })),
  setSearchQuery: (searchQuery) => set({ searchQuery, searchOpen: searchQuery.trim().length > 0 }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setHighlightTarget: (highlightTarget) => set({ highlightTarget }),
  setFocusedPath: (focusedPath, focusedOriginChapter) => set({ focusedPath, focusedOriginChapter }),
  setProfileEditorOpen: (profileEditorOpen) => set({ profileEditorOpen }),
  setProfileSessionLabel: (profileSessionLabel) => set({ profileSessionLabel }),
  clearHighlight: () => set({ highlightTarget: null }),
  setTheme: (theme) => {
    applyThemeToDocument(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage blocked (private mode / quota) — theme still applies for the session.
    }
    set({ theme });
  },
  setDirtyConfigIds: (dirtyConfigIds) => set({ dirtyConfigIds }),
  setCreateConfigOpen: (createConfigOpen) => set({ createConfigOpen }),
  setTrackConfigOpen: (trackConfigOpen) => set({ trackConfigOpen }),
}));
