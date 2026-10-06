import * as Location from 'expo-location';

import { parseFixedLocation, type Position } from '@/utils/location-sharing';

/**
 * Development and E2E builds only: `EXPO_PUBLIC_FIXED_LOCATION="lat,lng"` reports that position
 * instead of the device's, because a browser under automation can neither grant nor fake geolocation.
 * Release builds don't set it, so they always use the device.
 */
const FIXED_LOCATION = parseFixedLocation(process.env.EXPO_PUBLIC_FIXED_LOCATION);

/** Foreground ("while using the app") permission; asks the first time. */
export async function requestLocationPermission(): Promise<boolean> {
  if (FIXED_LOCATION) return true;
  const { granted } = await Location.requestForegroundPermissionsAsync();
  return granted;
}

/** The current position, stamped with when it was captured (the device fix's own time). */
export async function getCurrentPosition(): Promise<Position> {
  if (FIXED_LOCATION) return { ...FIXED_LOCATION, recordedAt: new Date().toISOString() };
  const { coords, timestamp } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: coords.latitude, longitude: coords.longitude, recordedAt: new Date(timestamp).toISOString() };
}
