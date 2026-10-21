import type { DriverRatingSummary } from '@/services/ratings';
import { t, tn } from '@/i18n/core';

/** "★ 4.7 · 12 ratings", or "No ratings yet" before the first one. Only backend numbers, never estimated. */
export function ratingSummaryLabel(summary: Pick<DriverRatingSummary, 'average' | 'count'>): string {
  if (summary.count === 0 || summary.average === null) return t('No ratings yet');
  const average = summary.average.toFixed(1);
  return tn(summary.count, '★ {average} · {count} rating', '★ {average} · {count} ratings', { average });
}

/** "★★★★☆" for one rating. */
export function starsText(score: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(score)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}
