import type { BadgeTone } from '@/components/ui/badge';
import type { DriverHistoryItem, HistoryFilter } from '@/services/deliveries';

export const HISTORY_FILTER_OPTIONS: { key: HistoryFilter | null; label: string; testID: string }[] = [
  { key: null, label: 'All', testID: 'history-filter-all' },
  { key: 'active', label: 'Active', testID: 'history-filter-active' },
  { key: 'completed', label: 'Completed', testID: 'history-filter-completed' },
  { key: 'cancelled', label: 'Cancelled', testID: 'history-filter-cancelled' },
];

/** How a history row's status reads: finished outcomes, or "In progress" for the current job. */
export function historyStatus(item: Pick<DriverHistoryItem, 'status'>): { label: string; tone: BadgeTone } {
  switch (item.status) {
    case 'DELIVERED':
      return { label: 'Delivered', tone: 'success' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'danger' };
    default:
      return { label: 'In progress', tone: 'brand' };
  }
}

/** When the delivery ended (or last changed, while still active). */
export function finishedAt(item: DriverHistoryItem): string {
  return item.deliveredAt ?? item.cancelledAt ?? item.updatedAt;
}

/** The stage times the backend recorded, in order; stages without a time are left out, never guessed. */
export function historyTimeline(item: DriverHistoryItem): { label: string; at: string }[] {
  const stages: [string, string | null][] = [
    ['Assigned', item.assignedAt],
    ['Picked up', item.pickedUpAt],
    ['Delivered', item.deliveredAt],
    ['Cancelled', item.cancelledAt],
  ];
  return stages.flatMap(([label, at]) => (at ? [{ label, at }] : []));
}

/** "Took 23 min" from assignment to delivery; null unless both times exist. */
export function deliveryDuration(item: DriverHistoryItem): string | null {
  if (!item.assignedAt || !item.deliveredAt) return null;
  const minutes = Math.round((new Date(item.deliveredAt).getTime() - new Date(item.assignedAt).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  return minutes < 1 ? 'Took under a minute' : `Took ${minutes} min`;
}

/** Joins loaded pages; a row can move between pages while new deliveries finish, so keep its first copy. */
export function mergeHistoryPages(pages: DriverHistoryItem[][]): DriverHistoryItem[] {
  const seen = new Set<string>();
  return pages.flat().filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Deliveries completed today, from the newest page of completed deliveries. If the whole (full) page
 * is from today there may be more on the next page, so `atLeast` says the count is a lower bound.
 */
export function completedToday(items: DriverHistoryItem[], pageSize: number, now = new Date()): { count: number; atLeast: boolean } {
  const today = items.filter((item) => item.deliveredAt && sameLocalDay(new Date(item.deliveredAt), now));
  return { count: today.length, atLeast: today.length === pageSize && items.length === pageSize };
}

export function completedTodayLabel({ count, atLeast }: { count: number; atLeast: boolean }): string {
  if (count === 0) return 'No deliveries completed yet today';
  const n = atLeast ? `${count}+` : String(count);
  return `${n} ${count === 1 && !atLeast ? 'delivery' : 'deliveries'} completed today`;
}
