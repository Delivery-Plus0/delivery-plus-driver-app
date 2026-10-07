import type { BadgeTone } from '@/components/ui/badge';
import type { EarningEntry } from '@/services/earnings';

const TYPE_LABELS: Record<EarningEntry['type'], string> = {
  DELIVERY_EARNING: 'Delivery',
  CANCELLATION_COMPENSATION: 'Cancelled after pickup',
  REVERSAL: 'Correction',
};

export function earningTypeLabel(entry: Pick<EarningEntry, 'type'>): string {
  return TYPE_LABELS[entry.type] ?? 'Earning';
}

/** The status line of one entry, as the backend reports it; never re-derived from the clock. */
export function earningStatus(entry: Pick<EarningEntry, 'status'>): { label: string; tone: BadgeTone } {
  return entry.status === 'AVAILABLE' ? { label: 'Available', tone: 'success' } : { label: 'Pending', tone: 'warning' };
}

/** "Earnings become available 12 hours after each delivery." from the backend's settlement window. */
export function settlementNote(hours: number): string {
  if (hours <= 0) return 'Earnings are available as soon as a delivery is finished.';
  const window = hours === 1 ? '1 hour' : `${hours} hours`;
  return `Earnings become available ${window} after each delivery.`;
}
