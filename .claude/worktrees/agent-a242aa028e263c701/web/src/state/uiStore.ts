import { create } from 'zustand';

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
  setActiveConfigId: (id: string | null) => void;
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
  setActiveConfigId: (activeConfigId) => set({ activeConfigId, focusedPath: null, focusedOriginChapter: null, profileEditorOpen: false, profileSessionLabel: '' }),
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
}));
