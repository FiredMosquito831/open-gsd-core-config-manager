import { create } from 'zustand';

interface UiState {
  activeConfigId: string | null;
  activeChapter: string | null;
  leftPaneOpen: boolean;
  middlePaneOpen: boolean;
  searchQuery: string;
  highlightTarget: string | null;
  setActiveConfigId: (id: string | null) => void;
  setActiveChapter: (chapter: string | null) => void;
  toggleLeftPane: () => void;
  toggleMiddlePane: () => void;
  setSearchQuery: (query: string) => void;
  setHighlightTarget: (target: string | null) => void;
  clearHighlight: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeConfigId: null,
  activeChapter: null,
  leftPaneOpen: true,
  middlePaneOpen: true,
  searchQuery: '',
  highlightTarget: null,
  setActiveConfigId: (activeConfigId) => set({ activeConfigId }),
  setActiveChapter: (activeChapter) => set({ activeChapter }),
  toggleLeftPane: () => set((state) => ({ leftPaneOpen: !state.leftPaneOpen })),
  toggleMiddlePane: () => set((state) => ({ middlePaneOpen: !state.middlePaneOpen })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setHighlightTarget: (highlightTarget) => set({ highlightTarget }),
  clearHighlight: () => set({ highlightTarget: null }),
}));
