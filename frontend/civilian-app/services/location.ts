import * as Location from 'expo-location';

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

// Resolve as soon as we get a fix this accurate or better.
// Falls back to the best reading seen after TIMEOUT_MS regardless.
const ACCURACY_TARGET_M = 30;
const TIMEOUT_MS = 8_000;

export async function getCurrentLocation(): Promise<GPSLocation | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    return await new Promise<GPSLocation | null>((resolve) => {
      let resolved = false;
      let subscription: Location.LocationSubscription | null = null;
      let bestFix: Location.LocationObject | null = null;

      const finish = (loc: Location.LocationObject | null) => {
        if (resolved) return;
        resolved = true;
        subscription?.remove();
        if (!loc) { resolve(null); return; }
        resolve({
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy:  loc.coords.accuracy,
        });
      };

      // Accept whatever we have once the timeout fires
      const timer = setTimeout(() => finish(bestFix), TIMEOUT_MS);

      Location.watchPositionAsync(
        {
          accuracy:         Location.Accuracy.BestForNavigation,
          timeInterval:     200,
          distanceInterval: 0,
        },
        (loc) => {
          // Track the most accurate reading seen so far
          const prevAcc = bestFix?.coords.accuracy ?? Infinity;
          const newAcc  = loc.coords.accuracy      ?? Infinity;
          if (newAcc < prevAcc) bestFix = loc;

          // Resolve early once we hit the target
          if (newAcc <= ACCURACY_TARGET_M) {
            clearTimeout(timer);
            finish(loc);
          }
        }
      )
        .then(sub => { subscription = sub; })
        .catch(() => finish(null));
    });
  } catch {
    return null;
  }
}

export function formatCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}
