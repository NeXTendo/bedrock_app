import { create } from 'zustand';

export interface RecentReport {
  id: string;
  description: string;
  address: string;
  status: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  photoUrl?: string;
  viewedAt: number; // timestamp
}

interface RecentlyViewedState {
  recent: RecentReport[];
  addRecent: (report: RecentReport) => void;
  clearRecent: () => void;
}

const MAX_RECENT = 8;

export const useRecentlyViewedStore = create<RecentlyViewedState>((set) => ({
  recent: [],
  addRecent: (report) =>
    set((state) => {
      // Remove existing entry for this ID, prepend new one, cap at MAX_RECENT
      const filtered = state.recent.filter((r) => r.id !== report.id);
      return { recent: [report, ...filtered].slice(0, MAX_RECENT) };
    }),
  clearRecent: () => set({ recent: [] }),
}));
