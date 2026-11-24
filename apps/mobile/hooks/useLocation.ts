import * as Location from 'expo-location';
import * as Device from 'expo-device';
import { useEffect, useState } from 'react';

// For development: Set this to true to force a specific location on emulators
const MOCK_EMULATOR_LOCATION = __DEV__ && !Device.isDevice;
const MOCK_COORDS = {
  latitude: -15.3875, // Lusaka, Zambia
  longitude: 28.3228,
};

// Module-level global cache for geocoding to prevent API rate-limiting
let cachedCoords: { latitude: number; longitude: number } | null = null;
let cachedAddress: string | null = null;

// Helper to calculate distance in meters between two coordinates (Haversine formula)
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function getPermissions() {
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        if (!enabled) {
          setErrorMsg('Location services are disabled');
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }

        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 120_000,
          requiredAccuracy: 1_000,
        });
        if (lastKnown) {
          setLocation(lastKnown);
        }

        let loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        // If we are on an emulator and it returns Google HQ, use our mock coordinates
        if (MOCK_EMULATOR_LOCATION && 
            Math.abs(loc.coords.latitude - 37.422) < 0.01 && 
            Math.abs(loc.coords.longitude - (-122.084)) < 0.01) {
          console.log('Emulator detected at Google HQ. Applying mock location...');
          loc = {
            ...loc,
            coords: {
              ...loc.coords,
              ...MOCK_COORDS,
            }
          };
        }

        setLocation(loc);

        // Check if coordinates match our cache (within 100 meters)
        if (
          cachedCoords && 
          cachedAddress && 
          getDistanceMeters(
            loc.coords.latitude, 
            loc.coords.longitude, 
            cachedCoords.latitude, 
            cachedCoords.longitude
          ) < 100
        ) {
          setAddress(cachedAddress);
        } else {
          try {
            // Reverse geocode to get address
            let reverse = await Location.reverseGeocodeAsync({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });

            if (reverse.length > 0) {
              const item = reverse[0];
              const streetNum = item.streetNumber ? `${item.streetNumber} ` : '';
              const street = item.street || '';
              const city = item.city ? `, ${item.city}` : '';
              const addrString = `${streetNum}${street}${city}`.trim();
              
              const formattedAddr = addrString || `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`;
              setAddress(formattedAddr);
              
              // Update geocode cache
              cachedCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
              cachedAddress = formattedAddr;
            } else {
              setAddress(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
            }
          } catch (geocodeError) {
            console.warn('Geocoding rate limit or failure, using coordinate fallback:', geocodeError);
            // Fall back to numeric coordinates gracefully
            setAddress(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
          }
        }
      } catch (error: any) {
        setErrorMsg(error.message || 'An error occurred while fetching location');
        console.error('Location error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    getPermissions();
  }, []);

  return { location, address, errorMsg, isLoading };
}
