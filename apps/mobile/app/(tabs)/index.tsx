import MapView, { Marker, Circle } from 'react-native-maps';
import { StyleSheet, View, Text, TouchableOpacity, useColorScheme, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useLocation } from '@/hooks/useLocation';
import { useMapStore } from '@/stores/mapStore';
import { getCategoryColor, theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useEffect, useState, useRef, Fragment, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/AppHeader';

import { useHeatmapStore } from '@/stores/useHeatmapStore';
import { HeatmapLegendKey } from '@/components/HeatmapLegendKey';
import { HeatmapOnboardingModal } from '@/components/HeatmapOnboardingModal';

const defaultRegion = {
  latitude: -15.4167,
  longitude: 28.2833,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

interface Cluster {
  reports: any[];
  lat: number;
  lng: number;
  color: string;
  categoryIcon: string;
}

function hexToRgba(hex: string, opacity: number): string {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

/**
 * Groups reports into spatial clusters using a zoom-aware grid.
 * Each grid cell is 20% of the visible latitude span.
 * Reports in the same cell are merged; centroid is recomputed iteratively.
 */
function computeClusters(reports: any[], latitudeDelta: number, colors: typeof theme.light): Cluster[] {
  const gridSize = Math.max(0.0002, latitudeDelta * 0.2);
  const grid = new Map<string, Cluster>();

  for (const report of reports) {
    const lat = Number(report.latitude);
    const lng = Number(report.longitude);
    if (isNaN(lat) || isNaN(lng)) continue;

    const cellLat = Math.floor(lat / gridSize);
    const cellLng = Math.floor(lng / gridSize);
    // Cluster purely by spatial proximity so mixed issues in the same area form one cluster instead of overlapping beacons
    const key = `${cellLat}_${cellLng}`;

    if (!grid.has(key)) {
      grid.set(key, {
        reports: [],
        lat,
        lng,
        color: report.categories?.color || getCategoryColor(report.categories?.icon, colors),
        categoryIcon: report.categories?.icon || 'flame.fill',
      });
    }

    const cell = grid.get(key)!;
    cell.reports.push(report);
    // Update centroid
    cell.lat =
      cell.reports.reduce((s: number, r: any) => s + Number(r.latitude), 0) /
      cell.reports.length;
    cell.lng =
      cell.reports.reduce((s: number, r: any) => s + Number(r.longitude), 0) /
      cell.reports.length;
  }

  const rawClusters = Array.from(grid.values());

  // Merge any adjacent clusters whose centroids ended up too close to prevent beacon overlap
  const mergedClusters: Cluster[] = [];
  const minSeparation = gridSize * 0.6;

  for (const cluster of rawClusters) {
    const existing = mergedClusters.find(
      (m) =>
        Math.abs(m.lat - cluster.lat) < minSeparation &&
        Math.abs(m.lng - cluster.lng) < minSeparation
    );

    if (existing) {
      existing.reports.push(...cluster.reports);
      existing.lat =
        existing.reports.reduce((s: number, r: any) => s + Number(r.latitude), 0) /
        existing.reports.length;
      existing.lng =
        existing.reports.reduce((s: number, r: any) => s + Number(r.longitude), 0) /
        existing.reports.length;
    } else {
      mergedClusters.push(cluster);
    }
  }

  // Set the dominant category icon & color for each cluster
  for (const cluster of mergedClusters) {
    if (cluster.reports.length > 1) {
      const iconCounts: Record<string, { count: number; color: string }> = {};
      for (const r of cluster.reports) {
        const icon = r.categories?.icon || 'flame.fill';
        const color = r.categories?.color || getCategoryColor(icon, colors);
        if (!iconCounts[icon]) iconCounts[icon] = { count: 0, color };
        iconCounts[icon].count++;
      }
      let topIcon = 'flame.fill';
      let topColor = colors.accent;
      let topCount = 0;
      for (const [icon, data] of Object.entries(iconCounts)) {
        if (data.count > topCount) {
          topCount = data.count;
          topIcon = icon;
          topColor = data.color;
        }
      }
      cluster.categoryIcon = topIcon;
      cluster.color = topColor;
    }
  }

  return mergedClusters;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { location, address } = useLocation();
  const { center, zoom, setCenter } = useMapStore();
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme, hapticsEnabled, mapStyle, setMapStyle } = useSettingsStore();
  const { heatmapVisible, heatmapType, setSelectedCluster } = useHeatmapStore();

  const currentTheme = storeTheme === 'auto'
    ? (systemColorScheme || 'light')
    : storeTheme;

  const colors = theme[currentTheme as 'light' | 'dark'];

  const mapType = mapStyle === 'satellite' ? 'satellite' : 'standard';
  const [legendVisible, setLegendVisible] = useState(true);
  const reappearTimeout = useRef<any>(null);

  // Track the visible map region so cluster size can scale with zoom
  const [currentRegion, setCurrentRegion] = useState(defaultRegion);

  const { data: reports } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_reports')
        .select('*');

      if (error) throw error;
      return data;
    },
  });

  const handleRegionChangeStart = () => {
    setLegendVisible(false);
    if (reappearTimeout.current) clearTimeout(reappearTimeout.current);
  };

  const handleRegionChangeComplete = (newRegion: typeof defaultRegion) => {
    setCurrentRegion(newRegion);
    setCenter([newRegion.longitude, newRegion.latitude]);
    if (reappearTimeout.current) clearTimeout(reappearTimeout.current);
    reappearTimeout.current = setTimeout(() => setLegendVisible(true), 400);
  };

  useEffect(() => {
    return () => {
      if (reappearTimeout.current) clearTimeout(reappearTimeout.current);
    };
  }, []);

  const recenter = () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 600);
    }
  };

  const region = {
    latitude: center[1] || defaultRegion.latitude,
    longitude: center[0] || defaultRegion.longitude,
    latitudeDelta: defaultRegion.latitudeDelta / (zoom / 4),
    longitudeDelta: defaultRegion.longitudeDelta / (zoom / 4),
  };

  // Filter reports for the active heatmap category
  const heatmapReports = useMemo(() => {
    if (!heatmapVisible || !reports) return [];
    return reports.filter((report: any) => {
      if (heatmapType === 'overall') return true;
      if (heatmapType === 'roads') return report.categories?.icon === 'car.fill';
      if (heatmapType === 'water') return report.categories?.icon === 'drop.fill';
      if (heatmapType === 'waste') return report.categories?.icon === 'trash.fill';
      if (heatmapType === 'power') return report.categories?.icon === 'bolt.fill';
      return true;
    });
  }, [reports, heatmapVisible, heatmapType]);

  // Compute spatial clusters from filtered reports
  const clusters = useMemo(
    () => computeClusters(heatmapReports, currentRegion.latitudeDelta, colors),
    [heatmapReports, currentRegion.latitudeDelta, colors]
  );

  const markerBucket = useMemo(() => {
    const d = currentRegion.latitudeDelta;
    if (d > 0.12) return 'sm';
    if (d > 0.035) return 'md';
    return 'lg';
  }, [currentRegion.latitudeDelta]);

  const MARKER_SIZES = { sm: 16, md: 22, lg: 28 } as const;
  const ICON_SIZES = { sm: 8, md: 10, lg: 12 } as const;
  const markerPx = MARKER_SIZES[markerBucket];
  const iconPx = ICON_SIZES[markerBucket];

  // Store cluster reports in the global store and navigate to detail screen
  const handleClusterPress = (cluster: Cluster) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const title = heatmapType.charAt(0).toUpperCase() + heatmapType.slice(1);
    setSelectedCluster(cluster.reports, {
      lat: cluster.lat,
      lng: cluster.lng,
      color: cluster.color,
      title,
      count: cluster.reports.length,
    });
    router.push('/report/cluster' as any);
  };

  // True physical ground radius in metres
  const getClusterRadius = (count: number): number => {
    const base = 140;
    return Math.max(90, Math.min(600, base * Math.pow(count, 0.45)));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Bedrock"
        subtitle={address || 'Locating...'}
        variant="floating"
        rightElement={
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => {
                if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/notifications' as any);
              }}
              style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.75}
            >
              <IconSymbol name="bell.fill" color={colors.textDim} size={17} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/settings' as any);
              }}
              style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.75}
            >
              <IconSymbol name="gearshape.fill" color={colors.textDim} size={17} />
            </TouchableOpacity>
          </View>
        }
      />

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        mapType={mapType}
        showsUserLocation={true}
        showsMyLocationButton={false}
        userInterfaceStyle={currentTheme as 'light' | 'dark'}
        onRegionChangeStart={handleRegionChangeStart}
        onRegionChangeComplete={handleRegionChangeComplete}
        customMapStyle={currentTheme === 'dark' ? mapDarkStyle : []}
      >
        {/* ── True Thermal Multi-Spectrum Heatmap Layers ── */}
        {heatmapVisible && clusters.map((cluster, i) => {
          const count = cluster.reports.length;
          const radius = getClusterRadius(count);
          const intensity = Math.min(count / 8, 1);

          return (
            <Fragment key={`thermal-cluster-${i}`}>
              {/* Category-colored density layers keep report types distinct. */}
              <Circle
                center={{ latitude: cluster.lat, longitude: cluster.lng }}
                radius={radius}
                fillColor={hexToRgba(cluster.color, 0.18 + intensity * 0.15)}
                strokeColor={hexToRgba(cluster.color, 0.42)}
                strokeWidth={1}
              />
              <Circle
                center={{ latitude: cluster.lat, longitude: cluster.lng }}
                radius={radius * 0.45}
                fillColor={hexToRgba(cluster.color, 0.32 + intensity * 0.28)}
                strokeColor={hexToRgba(cluster.color, 0.55)}
                strokeWidth={1}
              />

              {/* Interactive Sharp Civic Hotspot Beacon Marker */}
              <Marker
                coordinate={{ latitude: cluster.lat, longitude: cluster.lng }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
                onPress={() => handleClusterPress(cluster)}
              >
                <View style={[styles.clusterBeacon, { backgroundColor: colors.surface, borderColor: cluster.color }]}>
                  <IconSymbol
                    name={(cluster.categoryIcon || 'flame.fill') as any}
                    color={cluster.color}
                    size={11}
                  />
                  <Text style={[styles.clusterBeaconCount, { color: colors.text }]}>
                    {count}
                  </Text>
                </View>
              </Marker>
            </Fragment>
          );
        })}

        {/* ── Regular Sharp Pin Markers (when Heatmap is off) ── */}
        {!heatmapVisible && reports?.map((report: any) => (
          <Marker
            key={`${report.id}-${markerBucket}`}
            coordinate={{
              latitude: Number(report.latitude),
              longitude: Number(report.longitude),
            }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => router.push(`/report/${report.id}`)}
          >
            <View style={[
              styles.reportMarker,
              {
                width: markerPx,
                height: markerPx,
                borderRadius: 8,
                backgroundColor: colors.surface,
                borderColor: report.categories?.color || getCategoryColor(report.categories?.icon, colors),
              }
            ]}>
              <IconSymbol
                name={report.categories?.icon || 'paperplane.fill'}
                color={report.categories?.color || getCategoryColor(report.categories?.icon, colors)}
                size={iconPx}
              />
            </View>
          </Marker>
        ))}
      </MapView>



      {/* Map control buttons — grouped on the right */}
      <View style={[styles.mapControls, { bottom: insets.bottom + 88 }]}>
        <TouchableOpacity
          style={[styles.mapControlBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            setMapStyle(mapType === 'standard' ? 'satellite' : 'standard');
          }}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={mapType === 'standard' ? 'Switch to satellite map' : 'Switch to standard map'}
        >
          <IconSymbol name={mapType === 'standard' ? 'globe.americas.fill' : 'map.fill'} color={colors.textDim} size={17} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mapControlBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={recenter}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Center map on my location"
        >
          <IconSymbol name="location.fill" color={colors.accent} size={17} />
        </TouchableOpacity>
      </View>

      {/* Heatmap thermometer key — hides while panning */}
      <HeatmapLegendKey
        bottomOffset={insets.bottom + 88}
        visible={legendVisible}
        reportCount={reports?.length ?? 0}
        loading={reports === undefined}
      />

      {/* Paged onboarding modal */}
      <HeatmapOnboardingModal />
    </View>
  );
}

const mapDarkStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#20251F" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#CBC8BD" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#191D1A" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#3B463E" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#18211F" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#303630" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#252A24" }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  clusterBeacon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  clusterBeaconCount: {
    fontSize: 11,
    fontWeight: '800',
  },
  reportMarker: {
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  mapControls: {
    position: 'absolute',
    right: 14,
    gap: 8,
  },
  mapControlBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerRight: {
    flexDirection: 'row',
    gap: 7,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
