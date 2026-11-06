import MapView, { Region } from 'react-native-maps';
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useReportStore } from '@/stores/reportStore';
import { useLocation } from '@/hooks/useLocation';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useState, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export default function LocationStepScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const pinAnim = useRef(new Animated.Value(0)).current;

  const { setDraft } = useReportStore();
  const { location: userLocation, address: userAddress } = useLocation();
  const [selectedCoord, setSelectedCoord] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (userLocation && !selectedCoord) {
      setSelectedCoord([userLocation.coords.longitude, userLocation.coords.latitude]);
    }
  }, [userLocation, selectedCoord]);

  const recenter = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
      setSelectedCoord([userLocation.coords.longitude, userLocation.coords.latitude]);
    }
  };

  const onRegionChange = () => {
    Animated.timing(pinAnim, {
      toValue: -20,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onRegionChangeComplete = (region: Region) => {
    setSelectedCoord([region.longitude, region.latitude]);
    Animated.spring(pinAnim, {
      toValue: 0,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleNext = () => {
    if (selectedCoord) {
      setDraft({
        location: {
          latitude: selectedCoord[1],
          longitude: selectedCoord[0],
          address: userAddress || 'Selected Location',
        },
      });
      router.push('/report/create/category');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} 
          style={styles.backButton}
        >
          <IconSymbol name="chevron.right" color={theme.colors.text} size={24} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pin Location</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.mapContainer}>
        <MapView 
          ref={mapRef}
          style={styles.map} 
          onRegionChange={onRegionChange}
          onRegionChangeComplete={onRegionChangeComplete}
          initialRegion={{
            latitude: selectedCoord?.[1] || -15.4167,
            longitude: selectedCoord?.[0] || 28.2833,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
        />
        
        {/* Animated Fixed Center Pin */}
        <Animated.View 
          style={[
            styles.centerPinContainer, 
            { transform: [{ translateY: pinAnim }] }
          ]} 
          pointerEvents="none"
        >
          <View style={styles.pinShadow} />
          <IconSymbol name="mappin.and.ellipse" color={theme.colors.red} size={48} />
        </Animated.View>

        <TouchableOpacity 
          style={[styles.recenterButton, { bottom: 40 }]} 
          onPress={recenter}
        >
          <IconSymbol name="location.fill" color={theme.colors.text} size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.instruction}>Drag the map to place the pin precisely on the issue.</Text>
        <TouchableOpacity 
          style={[styles.nextButton, !selectedCoord && styles.disabledButton]} 
          onPress={handleNext}
          disabled={!selectedCoord}
        >
          <Text style={styles.nextText}>CONFIRM LOCATION</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 20,
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
    backgroundColor: theme.colors.surface,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 10,
  },
  footer: {
    padding: 24,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  instruction: {
    color: theme.colors.textDim,
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 14,
  },
  nextButton: {
    backgroundColor: theme.colors.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  nextText: {
    color: 'white',
    fontWeight: '800',
    letterSpacing: 1,
  },
});
