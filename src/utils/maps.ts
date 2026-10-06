type MapsDestination = {
  latitude?: number | null;
  longitude?: number | null;
  /** Used when there are no coordinates. */
  address?: string | null;
};

/**
 * A directions link for the driver's maps app (Google Maps universal URL: opens the app when it is
 * installed, the website otherwise). Coordinates win over the address; null when there is neither.
 */
export function directionsUrl({ latitude, longitude, address }: MapsDestination): string | null {
  const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude);
  const destination = hasCoordinates ? `${latitude},${longitude}` : address?.trim();
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
