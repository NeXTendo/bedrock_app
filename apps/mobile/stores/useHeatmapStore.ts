import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HeatmapType = 'overall' | 'roads' | 'water' | 'waste' | 'power';

export interface ClusterMeta {
  lat: number;
  lng: number;
  color: string;
  title: string;
  count: number;
}

interface HeatmapState {
  heatmapVisible: boolean;
  heatmapType: HeatmapType;
  hasSeenOnboarding: boolean;
  onboardingModalVisible: boolean;
  // Session-only (not persisted)
  selectedClusterReports: any[];
  selectedClusterMeta: ClusterMeta | null;
  toggleHeatmap: () => void;
  cycleHeatmapType: () => void;
  setHeatmapType: (type: HeatmapType) => void;
  setHasSeenOnboarding: (seen: boolean) => void;
  setOnboardingModalVisible: (visible: boolean) => void;
  setSelectedCluster: (reports: any[], meta: ClusterMeta) => void;
  clearSelectedCluster: () => void;
}

const HEATMAP_TYPES: HeatmapType[] = ['overall', 'roads', 'water', 'waste', 'power'];

export const useHeatmapStore = create<HeatmapState>()(
  persist(
    (set) => ({
      heatmapVisible: false,
      heatmapType: 'overall',
      hasSeenOnboarding: false,
      onboardingModalVisible: false,
      selectedClusterReports: [],
      selectedClusterMeta: null,

      toggleHeatmap: () => set((state) => ({ heatmapVisible: !state.heatmapVisible })),

      cycleHeatmapType: () => set((state) => {
        const currentIndex = HEATMAP_TYPES.indexOf(state.heatmapType);
        const nextIndex = (currentIndex + 1) % HEATMAP_TYPES.length;
        return { heatmapType: HEATMAP_TYPES[nextIndex] };
      }),

      setHeatmapType: (heatmapType) => set({ heatmapType }),

      setHasSeenOnboarding: (hasSeenOnboarding) => set({ hasSeenOnboarding }),

      setOnboardingModalVisible: (onboardingModalVisible) => set({ onboardingModalVisible }),

      setSelectedCluster: (reports, meta) =>
        set({ selectedClusterReports: reports, selectedClusterMeta: meta }),

      clearSelectedCluster: () =>
        set({ selectedClusterReports: [], selectedClusterMeta: null }),
    }),
    {
      name: 'heatmap-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user preferences, not session cluster data
      partialize: (state) => ({
        heatmapVisible: state.heatmapVisible,
        heatmapType: state.heatmapType,
        hasSeenOnboarding: state.hasSeenOnboarding,
      }),
    }
  )
);
