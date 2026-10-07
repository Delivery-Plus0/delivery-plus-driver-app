import type { DriverRatingSummary } from '@/services/ratings';

/** "★ 4.7 · 12 ratings", or "No ratings yet" before the first one. Only backend numbers, never estimated. */
export function ratingSummaryLabel(summary: Pick<DriverRatingSummary, 'average' | 'count'>): string {
  if (summary.count === 0 || summary.average === null) return 'No ratings yet';
  return `★ ${summary.average.toFixed(1)} · ${summary.count} ${summary.count === 1 ? 'rating' : 'ratings'}`;
}

/** "★★★★☆" for one rating. */
export function starsText(score: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(score)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}
