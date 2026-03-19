import * as Location from 'expo-location';
import * as Device from 'expo-device';

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

const SIMULATOR_LOCATION: GPSLocation = {
  latitude:  43.4723,
  longitude: -80.5449,
  accuracy:  5,
};

export async function getCurrentLocation(): Promise<GPSLocation | null> {
  if (!Device.isDevice) {
    return SIMULATOR_LOCATION;
  }

  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return SIMULATOR_LOCATION;

    // Balanced accuracy uses WiFi/cell triangulation — resolves in <1 second
    // anywhere, works indoors, no satellite lock required.
    // 5-second timeout guards against indefinite hangs when location services
    // are restricted or slow; catch block returns SIMULATOR_LOCATION fallback.
    const loc = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000),
      ),
    ]);
    return {
      latitude:  loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy:  loc.coords.accuracy,
    };
  } catch {
    return SIMULATOR_LOCATION;
  }
}

export function formatCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}
