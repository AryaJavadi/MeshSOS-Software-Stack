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
  latitude:  43.472747884244676,
  longitude: -80.53981750670509,
  accuracy:  5,
};

export async function getCurrentLocation(): Promise<GPSLocation | null> {
  if (!Device.isDevice) {
    return SIMULATOR_LOCATION;
  }

  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    // Balanced accuracy uses WiFi/cell triangulation — resolves in <1 second
    // anywhere, works indoors, no satellite lock required.
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude:  loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy:  loc.coords.accuracy,
    };
  } catch {
    return null;
  }
}

export function formatCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}
