import type { DeliveryStatus } from '@/services/deliveries';
import { t } from '@/i18n/core';

export type DeliveryStepKey = 'to_restaurant' | 'picked_up' | 'on_the_way' | 'delivered';
export type DeliveryStepState = 'done' | 'current' | 'upcoming';

export type DeliveryStep = { key: DeliveryStepKey; label: string; state: DeliveryStepState };

/** The stages a driver moves through on one job, in order. */
export const DELIVERY_STEPS: readonly { key: DeliveryStepKey; label: string }[] = [
  { key: 'to_restaurant', get label() { return t('To restaurant'); } },
  { key: 'picked_up', get label() { return t('Picked up'); } },
  { key: 'on_the_way', get label() { return t('On the way'); } },
  { key: 'delivered', get label() { return t('Delivered'); } },
];

/** Which step the delivery is in; -1 before a driver is assigned or when it was cancelled. */
const STEP_INDEX: Record<DeliveryStatus, number> = {
  CREATED: -1,
  DRIVER_ASSIGNED: 0,
  PICKED_UP: 1,
  IN_TRANSIT: 2,
  DELIVERED: 3,
  CANCELLED: -1,
};

/**
 * Step progress for the job card, derived only from the delivery status the backend reports.
 * Steps before the current one are done; a delivered job has every step done.
 */
export function deliverySteps(status: DeliveryStatus): DeliveryStep[] {
  const current = STEP_INDEX[status];
  return DELIVERY_STEPS.map((step, index) => ({
    ...step,
    state: index < current || (status === 'DELIVERED' && index === current) ? 'done' : index === current ? 'current' : 'upcoming',
  }));
}

/** "Step 2 of 4 · Picked up", or null when the delivery isn't in a driver step. */
export function deliveryProgressLabel(status: DeliveryStatus): string | null {
  const current = STEP_INDEX[status];
  if (current < 0) return null;
  return t('Step {n} of {total} · {label}', { n: current + 1, total: DELIVERY_STEPS.length, label: DELIVERY_STEPS[current].label });
}
