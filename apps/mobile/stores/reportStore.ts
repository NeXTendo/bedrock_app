import { create } from 'zustand';
import type { ReportAnswer } from '@/constants/reportQuestions';

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
  occurredAt: string | null;
  immediateDanger: ReportAnswer;
  categoryDetails: Record<string, ReportAnswer>;
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
  occurredAt: null,
  immediateDanger: 'unsure',
  categoryDetails: {},
  description: '',
  isAnonymous: false,
};

export const useReportStore = create<ReportState>((set) => ({
  draft: initialDraft,
  setDraft: (newDraft) =>
    set((state) => ({ draft: { ...state.draft, ...newDraft } })),
  resetDraft: () => set({ draft: initialDraft }),
}));
