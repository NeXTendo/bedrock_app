import MapView, { Region } from 'react-native-maps';
import { ActivityIndicator, Alert, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useReportStore } from '@/stores/reportStore';
import { useLocation } from '@/hooks/useLocation';
import { useAppColors } from '@/hooks/useAppColors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useState, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export default function LocationStepScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const mapRef = useRef<MapView>(null);
  const hasManuallyMovedMap = useRef(false);
  const pendingRecenter = useRef(false);

  const { setDraft } = useReportStore();
  const {
    location: userLocation,
    address: userAddress,
    errorMsg: locationError,
    isLoading: isLocationLoading,
  } = useLocation();
  const [selectedCoord, setSelectedCoord] = useState<[number, number] | null>(null);

  const currentCoord: [number, number] | null = selectedCoord ?? (
    userLocation
      ? [userLocation.coords.longitude, userLocation.coords.latitude]
      : null
  );

  useEffect(() => {
    if (!userLocation) return;
    if (!pendingRecenter.current && hasManuallyMovedMap.current) return;

    pendingRecenter.current = false;
    const coordinate: [number, number] = [
      userLocation.coords.longitude,
      userLocation.coords.latitude,
    ];
    setSelectedCoord(coordinate);
    mapRef.current?.animateToRegion({
      latitude: coordinate[1],
      longitude: coordinate[0],
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }, 500);
  }, [userLocation]);

  const recenter = () => {
    if (!userLocation) {
      pendingRecenter.current = true;
      if (!isLocationLoading) {
        Alert.alert('Location unavailable', locationError || 'Your location could not be determined.');
      }
      return;
    }
    pendingRecenter.current = false;
    setSelectedCoord([userLocation.coords.longitude, userLocation.coords.latitude]);
    mapRef.current?.animateToRegion({
      latitude: userLocation.coords.latitude,
      longitude: userLocation.coords.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }, 500);
  };

  const onRegionChangeComplete = (region: Region) => {
    setSelectedCoord([region.longitude, region.latitude]);
  };

  const handleNext = () => {
    if (currentCoord) {
      setDraft({
        location: {
          latitude: currentCoord[1],
          longitude: currentCoord[0],
          address: userAddress || 'Selected Location',
        },
      });
      router.push('/report/create/category');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
        <TouchableOpacity 
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} 
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Choose a location</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.mapContainer}>
        <MapView 
          ref={mapRef}
          style={styles.map} 
          onPanDrag={() => { hasManuallyMovedMap.current = true; }}
          onRegionChangeComplete={onRegionChangeComplete}
          initialRegion={{
            latitude: currentCoord?.[1] ?? -15.4167,
            longitude: currentCoord?.[0] ?? 28.2833,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
        />
        
        <View
          style={styles.centerPinContainer}
          pointerEvents="none"
        >
          <View style={styles.pinShadow} />
          <IconSymbol name="mappin.and.ellipse" color={colors.error} size={48} />
        </View>

        <TouchableOpacity 
          style={[styles.recenterButton, { bottom: 40, backgroundColor: colors.surface, borderColor: colors.border }]} 
          onPress={recenter}
          accessibilityRole="button"
          accessibilityLabel="Center map on my location"
        >
          {isLocationLoading && !userLocation
            ? <ActivityIndicator size="small" color={colors.text} />
            : <IconSymbol name="location.fill" color={colors.text} size={22} />}
        </TouchableOpacity>
      </View>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Text style={[styles.instruction, { color: colors.textDim }]}>Move the map to place the pin at the issue.</Text>
        <TouchableOpacity 
          style={[styles.nextButton, { backgroundColor: colors.accent }, !currentCoord && styles.disabledButton]} 
          onPress={handleNext}
          disabled={!currentCoord}
        >
          <Text style={styles.nextText}>Confirm location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F2EA',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -48, // Adjust based on icon size
    marginLeft: -24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pinShadow: {
    position: 'absolute',
    bottom: 0,
    width: 8,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 4,
    transform: [{ scaleX: 2.5 }],
  },
  recenterButton: {
    position: 'absolute',
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 10,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
  },
  instruction: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 14,
  },
  nextButton: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  nextText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
