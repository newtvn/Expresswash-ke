import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  recentSearches: string[];
  addRecentSearch: (search: string) => void;
  clearRecentSearches: () => void;

  reportDateRange: { start: string; end: string } | null;
  setReportDateRange: (range: { start: string; end: string } | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      recentSearches: [],
      addRecentSearch: (search) =>
        set((state) => ({
          recentSearches: [
            search,
            ...state.recentSearches.filter((s) => s !== search),
          ].slice(0, 10),
        })),
      clearRecentSearches: () => set({ recentSearches: [] }),

      reportDateRange: null,
      setReportDateRange: (range) => set({ reportDateRange: range }),
    }),
    {
      name: 'expresswash-app',
    }
  )
);
