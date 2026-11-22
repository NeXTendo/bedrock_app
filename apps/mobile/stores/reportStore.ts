import { create } from 'zustand';

interface ReportDraft {
  photos: string[];
  location: {
    latitude: number;
    longitude: number;
    address: string;
  } | null;
  category: string | null;
  categoryName: string | null;
  subcategory: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  isAnonymous: boolean;
}

interface ReportState {
  draft: ReportDraft;
  setDraft: (draft: Partial<ReportDraft>) => void;
  resetDraft: () => void;
}

const initialDraft: ReportDraft = {
  photos: [],
  location: null,
  category: null,
  categoryName: null,
  subcategory: null,
  severity: 'medium',
  description: '',
  isAnonymous: false,
};

export const useReportStore = create<ReportState>((set) => ({
  draft: initialDraft,
  setDraft: (newDraft) =>
    set((state) => ({ draft: { ...state.draft, ...newDraft } })),
  resetDraft: () => set({ draft: initialDraft }),
}));
