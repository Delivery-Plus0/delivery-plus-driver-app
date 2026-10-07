import { useResource } from '@/hooks/use-resource';
import {
  fetchCurrentDelivery,
  fetchDeliveryHistory,
  performDeliveryAction,
  type CurrentDelivery,
  type DeliveryAction,
  type DriverHistoryPage,
  type HistoryFilter,
} from '@/services/deliveries';
import { fetchMyDriver, goOffline, goOnline, registerVehicle, type Driver, type RegisterVehicleRequest } from '@/services/drivers';
import { fetchMyEarnings, type DriverEarnings } from '@/services/earnings';
import { fetchMyRatingSummary, type DriverRatingSummary } from '@/services/ratings';
import { fetchResource, setResourceData } from '@/state/resource-cache';
import { isOnShift } from '@/utils/driver-status';

const DRIVER_KEY = 'driver:me';
const CURRENT_DELIVERY_KEY = 'delivery:current';
const historyKey = (filter: HistoryFilter | null) => `delivery:history:${filter ?? 'all'}`;
const COMPLETED_TODAY_KEY = 'delivery:history:today';
const EARNINGS_KEY = 'driver:earnings';

/** Newest completed deliveries fetched for the Today count; the backend allows up to 50 per page. */
export const COMPLETED_TODAY_PAGE = 50;

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

/** First page of the driver's history for a filter (#142); later pages are loaded by the screen. */
export function useDeliveryHistory(filter: HistoryFilter | null) {
  return useResource<DriverHistoryPage>(historyKey(filter), () => fetchDeliveryHistory(filter), { staleTimeMs: 10_000 });
}

/** The newest completed deliveries, for "N deliveries completed today" on the Today tab. */
export function useCompletedTodayPage() {
  return useResource<DriverHistoryPage>(COMPLETED_TODAY_KEY, () => fetchDeliveryHistory('completed', 1, COMPLETED_TODAY_PAGE), {
    staleTimeMs: 30_000,
  });
}

/** The driver's rating from customers (#144): average, count and recent comments, from the backend. */
export function useMyRatingSummary() {
  return useResource<DriverRatingSummary>('driver:rating-summary', fetchMyRatingSummary, { staleTimeMs: 60_000 });
}

/** The driver's earnings from the backend ledger (#145/#146): totals and the newest entries. */
export function useMyEarnings() {
  return useResource<DriverEarnings>(EARNINGS_KEY, () => fetchMyEarnings(), { staleTimeMs: 30_000 });
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
  if (action === 'complete') {
    // The finished job now belongs in the Today count; the History tab revalidates when opened.
    void fetchResource(COMPLETED_TODAY_KEY, () => fetchDeliveryHistory('completed', 1, COMPLETED_TODAY_PAGE)).catch(() => undefined);
    // The new earning is in the ledger now (#145); refresh the Wallet's copy.
    void fetchResource(EARNINGS_KEY, () => fetchMyEarnings()).catch(() => undefined);
  }
}
