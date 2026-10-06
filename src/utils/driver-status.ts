import type { DeliveryAction, DeliveryStatus } from '@/services/deliveries';
import type { DriverStatus } from '@/services/drivers';

/** Only DRIVER accounts may use this app; other roles are refused at sign-in. */
export const DRIVER_ROLE = 'DRIVER';

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  OFFLINE: 'Offline',
  AVAILABLE: 'Online · waiting for a job',
  BUSY: 'On a delivery',
  SUSPENDED: 'Suspended',
};

/**
 * Whether the online/offline switch is usable. A BUSY driver can't change it themselves (the backend
 * frees them when the delivery completes or is cancelled), and SUSPENDED is admin-only.
 */
export function canToggleOnline(status: DriverStatus): boolean {
  return status === 'OFFLINE' || status === 'AVAILABLE';
}

/** On shift = deliveries can arrive or are in progress, so the current delivery is polled. */
export function isOnShift(status: DriverStatus | undefined): boolean {
  return status === 'AVAILABLE' || status === 'BUSY';
}

export const ACTION_LABELS: Record<DeliveryAction, string> = {
  pickup: 'Picked up the order',
  start: 'Start delivery',
  complete: 'Mark as delivered',
};

export type ActionConfirmation = { title: string; message: string; confirmLabel: string };

/** Every driver action is one-way (the backend has no undo), so each asks for confirmation first. */
export const ACTION_CONFIRMATIONS: Record<DeliveryAction, ActionConfirmation> = {
  pickup: {
    title: 'Picked up the order?',
    message: 'Confirm you have collected the order from the restaurant. The customer is told it has been picked up.',
    confirmLabel: 'Yes, picked up',
  },
  start: {
    title: 'Start the delivery?',
    message: 'The customer is told you are on the way. This cannot be undone.',
    confirmLabel: 'Start delivery',
  },
  complete: {
    title: 'Mark as delivered?',
    message: 'Only do this once the customer has the order. This completes the order and cannot be undone.',
    confirmLabel: 'Mark as delivered',
  },
};

export const DELIVERY_STAGE_LABELS: Record<DeliveryStatus, string> = {
  CREATED: 'Waiting for a driver',
  DRIVER_ASSIGNED: 'Go to the restaurant',
  PICKED_UP: 'Order picked up',
  IN_TRANSIT: 'On the way to the customer',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** The single next step the driver can take, as the backend reports it (`nextActions`). */
export function nextAction(delivery: { nextActions: DeliveryAction[] } | null | undefined): DeliveryAction | null {
  return delivery?.nextActions[0] ?? null;
}
