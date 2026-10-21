import type { BadgeTone } from '@/components/ui/badge';
import type { EarningEntry } from '@/services/earnings';
import { t, tn } from '@/i18n/core';

const TYPE_LABELS: Record<EarningEntry['type'], string> = {
  get DELIVERY_EARNING() {
    return t('Delivery');
  },
  get CANCELLATION_COMPENSATION() {
    return t('Cancelled after pickup');
  },
  get REVERSAL() {
    return t('Correction');
  },
};

export function earningTypeLabel(entry: Pick<EarningEntry, 'type'>): string {
  return TYPE_LABELS[entry.type] ?? t('Earning');
}

/** The status line of one entry, as the backend reports it; never re-derived from the clock. */
export function earningStatus(entry: Pick<EarningEntry, 'status'>): { label: string; tone: BadgeTone } {
  return entry.status === 'AVAILABLE' ? { label: t('Available'), tone: 'success' } : { label: t('Pending'), tone: 'warning' };
}

/** "Earnings become available 12 hours after each delivery." from the backend's settlement window. */
export function settlementNote(hours: number): string {
  if (hours <= 0) return t('Earnings are available as soon as a delivery is finished.');
  return tn(hours, 'Earnings become available {count} hour after each delivery.', 'Earnings become available {count} hours after each delivery.');
}
