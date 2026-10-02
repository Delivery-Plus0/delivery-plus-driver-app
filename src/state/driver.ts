import { useResource } from '@/hooks/use-resource';
import { fetchCurrentDelivery, performDeliveryAction, type CurrentDelivery, type DeliveryAction } from '@/services/deliveries';
import { fetchMyDriver, goOffline, goOnline, registerVehicle, type Driver, type RegisterVehicleRequest } from '@/services/drivers';
import { fetchResource, setResourceData } from '@/state/resource-cache';
import { isOnShift } from '@/utils/driver-status';

const DRIVER_KEY = 'driver:me';
const CURRENT_DELIVERY_KEY = 'delivery:current';

/** While on shift, check for a newly assigned delivery (and status changes) this often. */
export const ON_SHIFT_POLL_MS = 5_000;

/** The signed-in driver's profile; `null` until the vehicle is registered. Polled while on shift. */
export function useMyDriver() {
  return useResource<Driver | null>(DRIVER_KEY, fetchMyDriver, {
    staleTimeMs: 2_000,
    pollIntervalMs: (driver) => (isOnShift(driver?.status) ? ON_SHIFT_POLL_MS : 0),
  });
}

/**
 * The delivery assigned to this driver, or `null` (waiting for a job). Only fetched while on shift.
 * Polling for now; a push channel can replace this hook later without changing the screen.
 */
export function useCurrentDelivery(driver: Driver | null | undefined) {
  return useResource<CurrentDelivery | null>(isOnShift(driver?.status) ? CURRENT_DELIVERY_KEY : null, fetchCurrentDelivery, {
    staleTimeMs: 2_000,
    pollIntervalMs: ON_SHIFT_POLL_MS,
  });
}

export async function registerMyVehicle(payload: RegisterVehicleRequest): Promise<Driver> {
  const driver = await registerVehicle(payload);
  setResourceData<Driver | null>(DRIVER_KEY, driver);
  return driver;
}

export async function setOnline(online: boolean): Promise<Driver> {
  const driver = online ? await goOnline() : await goOffline();
  setResourceData<Driver | null>(DRIVER_KEY, driver);
  return driver;
}

/** Performs the action, then refreshes both the delivery and the driver (completing frees the driver). */
export async function advanceDelivery(deliveryId: string, action: DeliveryAction): Promise<void> {
  await performDeliveryAction(deliveryId, action);
  await Promise.all([fetchResource(CURRENT_DELIVERY_KEY, fetchCurrentDelivery), fetchResource(DRIVER_KEY, fetchMyDriver)]);
}
