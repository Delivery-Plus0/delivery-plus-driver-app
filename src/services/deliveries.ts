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
