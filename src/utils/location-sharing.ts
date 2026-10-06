import type { DeliveryStatus } from '@/services/deliveries';

export type Position = {
  latitude: number;
  longitude: number;
  /**
   * When the position was captured (ISO 8601). The backend only uses it to reject future, too old or
   * replayed reports (#60); it never makes a position look fresher than when the server received it.
   */
  recordedAt?: string;
};

export type LocationSharingState = 'off' | 'starting' | 'sharing' | 'denied' | 'unavailable';

/** How often the driver's position is sent while on a delivery (the backend keeps the last one for 5 min). */
export const LOCATION_INTERVAL_MS = 10_000;

export const LOCATION_SHARING_LABELS: Record<LocationSharingState, string> = {
  off: 'Location sharing is off',
  starting: 'Starting location sharing…',
  sharing: 'Sharing your location with the customer',
  denied: 'Location access is off. Allow it so the customer can follow the delivery.',
  unavailable: 'Your location is unavailable right now. Retrying…',
};

/** The customer can follow the driver from assignment until the order is handed over. */
export function shouldShareLocation(status: DeliveryStatus | undefined): boolean {
  return status === 'DRIVER_ASSIGNED' || status === 'PICKED_UP' || status === 'IN_TRANSIT';
}

/** `"30.0444,31.2357"` → a position; anything else (unset, malformed, out of range) → `null`. */
export function parseFixedLocation(value: string | undefined): Position | null {
  const parts = value?.split(',').map((part) => part.trim());
  if (parts?.length !== 2 || parts.some((part) => part === '')) return null;
  const [latitude, longitude] = parts.map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export type LocationSharingDeps = {
  requestPermission: () => Promise<boolean>;
  getPosition: () => Promise<Position>;
  report: (position: Position) => Promise<void>;
  intervalMs?: number;
};

/**
 * Asks for permission once, then sends the position immediately and every `intervalMs` until the
 * returned `stop` is called. A failed read or send is reported as `unavailable` and retried on the
 * next tick; a refused permission stops the loop (`denied`).
 */
export function startLocationSharing(deps: LocationSharingDeps, onState: (state: LocationSharingState) => void): () => void {
  const intervalMs = deps.intervalMs ?? LOCATION_INTERVAL_MS;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const emit = (state: LocationSharingState) => {
    if (!stopped) onState(state);
  };

  async function tick() {
    try {
      await deps.report(await deps.getPosition());
      emit('sharing');
    } catch {
      emit('unavailable');
    }
    if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
  }

  emit('starting');
  void deps.requestPermission().then(
    (granted) => {
      if (stopped) return;
      if (granted) void tick();
      else emit('denied');
    },
    () => emit('denied'),
  );

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
