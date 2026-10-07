import { apiGet, apiPost } from '@/services/api';

export type DeliveryStatus = 'CREATED' | 'DRIVER_ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

/** The driver actions that move a delivery forward: POST /api/deliveries/:id/<action>. */
export type DeliveryAction = 'pickup' | 'start' | 'complete';

/** GET /api/deliveries/me/current (delivery-service, DRIVER only). */
export type CurrentDelivery = {
  id: string;
  status: DeliveryStatus;
  orderId: string;
  createdAt: string;
  updatedAt: string;
  pickup: { restaurantId: string; name: string; address: string };
  dropOff: { address: string | null; notes: string | null; latitude: number | null; longitude: number | null };
  order: { id: string; items: { name: string; quantity: number }[]; totalAmount: string };
  nextActions: DeliveryAction[];
};

/**
 * The delivery assigned to the signed-in driver, or `null` when there is none: the backend answers
 * 204 No Content, which the API client returns as an empty body. Which driver is asking comes from
 * the token, never from the app.
 */
export async function fetchCurrentDelivery(): Promise<CurrentDelivery | null> {
  const current = await apiGet<CurrentDelivery | undefined>('/api/deliveries/me/current', true);
  return current ?? null;
}

/** Retry-safe on the server: repeating an action that already happened re-runs its side effects, not 409. */
export async function performDeliveryAction(deliveryId: string, action: DeliveryAction): Promise<{ id: string; status: DeliveryStatus }> {
  return apiPost<{ id: string; status: DeliveryStatus }>(`/api/deliveries/${deliveryId}/${action}`, {}, true);
}

/** GET /api/deliveries/me/history filters (delivery-service #142). */
export type HistoryFilter = 'active' | 'completed' | 'cancelled';

/** One of the signed-in driver's deliveries. No customer identity: the backend never sends it. */
export type DriverHistoryItem = {
  id: string;
  orderId: string;
  status: DeliveryStatus;
  assignedAt: string | null;
  /** Null for deliveries picked up before the backend recorded stage times. */
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  /** Null when the backend could not load the restaurant (the row is still real). */
  restaurant: { id: string; name: string } | null;
  order: { items: { name: string; quantity: number }[]; totalAmount: string; dropOffAddress: string | null } | null;
};

export type DriverHistoryPage = { items: DriverHistoryItem[]; page: number; limit: number; total: number; totalPages: number };

export const HISTORY_PAGE_SIZE = 20;

/** The signed-in driver's deliveries, newest first. Which driver comes from the token, never from the app. */
export async function fetchDeliveryHistory(
  filter: HistoryFilter | null,
  page = 1,
  limit = HISTORY_PAGE_SIZE,
): Promise<DriverHistoryPage> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filter) query.set('status', filter);
  return apiGet<DriverHistoryPage>(`/api/deliveries/me/history?${query.toString()}`, true);
}
