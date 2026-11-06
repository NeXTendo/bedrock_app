import { create } from 'zustand';

interface MapState {
  center: [number, number]; // [lng, lat]
  zoom: number;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  filters: {
    categories: string[];
    status: string[];
    radius: number;
  };
  setFilters: (filters: Partial<MapState['filters']>) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [28.2833, -15.4167], // Default to Lusaka, Zambia or similar
  zoom: 12,
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  filters: {
    categories: [],
    status: [],
    radius: 2000,
  },
  setFilters: (newFilters) =>
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),
}));
