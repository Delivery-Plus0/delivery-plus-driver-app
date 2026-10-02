import { useEffect, useState } from 'react';

import { getCurrentPosition, requestLocationPermission } from '@/services/location';
import { reportLocation } from '@/services/tracking';
import { startLocationSharing, type LocationSharingState } from '@/utils/location-sharing';

/**
 * Sends the driver's position while `active` (foreground only: the app must be open). Stops on
 * unmount or when `active` turns false, e.g. once the delivery is completed.
 */
export function useLocationSharing(active: boolean): LocationSharingState {
  const [state, setState] = useState<LocationSharingState>('starting');

  useEffect(() => {
    if (!active) return;
    return startLocationSharing(
      { requestPermission: requestLocationPermission, getPosition: getCurrentPosition, report: reportLocation },
      setState,
    );
  }, [active]);

  return active ? state : 'off';
}
