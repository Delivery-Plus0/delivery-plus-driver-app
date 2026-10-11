import type { DeliveryAction, DeliveryStatus } from '@/services/deliveries';
import type { DriverStatus } from '@/services/drivers';
import { t } from '@/i18n/core';

/** Only DRIVER accounts may use this app; other roles are refused at sign-in. */
export const DRIVER_ROLE = 'DRIVER';

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  get OFFLINE() {
    return t('Offline');
  },
  get AVAILABLE() {
    return t('Online · waiting for a job');
  },
  get BUSY() {
    return t('On a delivery');
  },
  get SUSPENDED() {
    return t('Suspended');
  },
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
  get pickup() {
    return t('Picked up the order');
  },
  get start() {
    return t('Start delivery');
  },
  get complete() {
    return t('Mark as delivered');
  },
};

export type ActionConfirmation = { title: string; message: string; confirmLabel: string };

/** Every driver action is one-way (the backend has no undo), so each asks for confirmation first. */
export const ACTION_CONFIRMATIONS: Record<DeliveryAction, ActionConfirmation> = {
  pickup: {
    get title() {
      return t('Picked up the order?');
    },
    get message() {
      return t('Confirm you have collected the order from the restaurant. The customer is told it has been picked up.');
    },
    get confirmLabel() {
      return t('Yes, picked up');
    },
  },
  start: {
    get title() {
      return t('Start the delivery?');
    },
    get message() {
      return t('The customer is told you are on the way. This cannot be undone.');
    },
    get confirmLabel() {
      return t('Start delivery');
    },
  },
  complete: {
    get title() {
      return t('Mark as delivered?');
    },
    get message() {
      return t('Only do this once the customer has the order. This completes the order and cannot be undone.');
    },
    get confirmLabel() {
      return t('Mark as delivered');
    },
  },
};

export const DELIVERY_STAGE_LABELS: Record<DeliveryStatus, string> = {
  get CREATED() {
    return t('Waiting for a driver');
  },
  get DRIVER_ASSIGNED() {
    return t('Go to the restaurant');
  },
  get PICKED_UP() {
    return t('Order picked up');
  },
  get IN_TRANSIT() {
    return t('On the way to the customer');
  },
  get DELIVERED() {
    return t('Delivered');
  },
  get CANCELLED() {
    return t('Cancelled');
  },
};

/** The single next step the driver can take, as the backend reports it (`nextActions`). */
export function nextAction(delivery: { nextActions: DeliveryAction[] } | null | undefined): DeliveryAction | null {
  return delivery?.nextActions[0] ?? null;
}
