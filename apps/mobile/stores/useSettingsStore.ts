import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type MapStyleMode = 'standard' | 'satellite' | 'hybrid';
export type AlertRadius = 1 | 3 | 5 | 10;

interface SettingsState {
  // Appearance
  theme: ThemeMode;
  mapStyle: MapStyleMode;
  hapticsEnabled: boolean;

  // Notifications & Alerts
  notificationsEnabled: boolean;
  statusUpdateNotifications: boolean;
  nearbyAlerts: boolean;
  alertRadiusKm: AlertRadius;
  communityFeedbackAlerts: boolean;

  // Data & Storage
  lowDataMode: boolean;
  wifiOnlyUpload: boolean;
  offlineSyncEnabled: boolean;

  // Privacy & Geolocation
  anonymousByDefault: boolean;
  highAccuracyGps: boolean;

  // Media & Camera
  saveToCameraRoll: boolean;
  addTimestampWatermark: boolean;

  // Setters & toggles
  setTheme: (theme: ThemeMode) => void;
  setMapStyle: (style: MapStyleMode) => void;
  toggleHaptics: () => void;
  toggleNotifications: () => void;
  toggleStatusUpdates: () => void;
  toggleNearbyAlerts: () => void;
  setAlertRadius: (radius: AlertRadius) => void;
  toggleCommunityFeedback: () => void;
  toggleLowDataMode: () => void;
  toggleWifiOnlyUpload: () => void;
  toggleOfflineSync: () => void;
  toggleAnonymousByDefault: () => void;
  toggleHighAccuracyGps: () => void;
  toggleSaveToCameraRoll: () => void;
  toggleTimestampWatermark: () => void;
  resetToDefaults: () => void;
}

const defaultState = {
  theme: 'auto' as ThemeMode,
  mapStyle: 'standard' as MapStyleMode,
  hapticsEnabled: true,
  notificationsEnabled: true,
  statusUpdateNotifications: true,
  nearbyAlerts: true,
  alertRadiusKm: 5 as AlertRadius,
  communityFeedbackAlerts: true,
  lowDataMode: false,
  wifiOnlyUpload: false,
  offlineSyncEnabled: true,
  anonymousByDefault: false,
  highAccuracyGps: true,
  saveToCameraRoll: false,
  addTimestampWatermark: true,
};

const triggerHaptic = (style: 'impact' | 'notify' = 'impact') => {
  import('expo-haptics').then((Haptics) => {
    if (style === 'notify') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }).catch(() => {});
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultState,

      setTheme: (theme) => set({ theme }),
      
      setMapStyle: (mapStyle) => {
        triggerHaptic();
        set({ mapStyle });
      },

      toggleHaptics: () =>
        set((state) => {
          const newValue = !state.hapticsEnabled;
          if (newValue) {
            triggerHaptic('notify');
          }
          return { hapticsEnabled: newValue };
        }),

      toggleNotifications: () =>
        set((state) => {
          if (state.hapticsEnabled) triggerHaptic();
          return { notificationsEnabled: !state.notificationsEnabled };
        }),

      toggleStatusUpdates: () =>
        set((state) => {
          if (state.hapticsEnabled) triggerHaptic();
          return { statusUpdateNotifications: !state.statusUpdateNotifications };
        }),

      toggleNearbyAlerts: () =>
        set((state) => {
          if (state.hapticsEnabled) triggerHaptic();
          return { nearbyAlerts: !state.nearbyAlerts };
        }),

      setAlertRadius: (alertRadiusKm) => {
        triggerHaptic();
        set({ alertRadiusKm });
      },

      toggleCommunityFeedback: () =>
        set((state) => {
          if (state.hapticsEnabled) triggerHaptic();
          return { communityFeedbackAlerts: !state.communityFeedbackAlerts };
        }),

      toggleLowDataMode: () =>
        set((state) => {
          if (state.hapticsEnabled) triggerHaptic();
          return { lowDataMode: !state.lowDataMode };
        }),

      toggleWifiOnlyUpload: () =>
        set((state) => {
          if (state.hapticsEnabled) triggerHaptic();
          return { wifiOnlyUpload: !state.wifiOnlyUpload };
        }),

      toggleOfflineSync: () =>
        set((state) => {
          if (state.hapticsEnabled) triggerHaptic();
          return { offlineSyncEnabled: !state.offlineSyncEnabled };
        }),

      toggleAnonymousByDefault: () =>
        set((state) => {
          if (state.hapticsEnabled) triggerHaptic();
          return { anonymousByDefault: !state.anonymousByDefault };
        }),

      toggleHighAccuracyGps: () =>
        set((state) => {
          if (state.hapticsEnabled) triggerHaptic();
          return { highAccuracyGps: !state.highAccuracyGps };
        }),

      toggleSaveToCameraRoll: () =>
        set((state) => {
          if (state.hapticsEnabled) triggerHaptic();
          return { saveToCameraRoll: !state.saveToCameraRoll };
        }),

      toggleTimestampWatermark: () =>
        set((state) => {
          if (state.hapticsEnabled) triggerHaptic();
          return { addTimestampWatermark: !state.addTimestampWatermark };
        }),

      resetToDefaults: () => {
        triggerHaptic('notify');
        set({ ...defaultState });
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
