import { apiGet } from '@/services/api';

/** One rating as the driver sees it: score, comment and date, never who wrote it. */
export type DriverRating = { score: number; comment: string | null; createdAt: string };

/** GET /api/deliveries/me/rating-summary (delivery-service #144). */
export type DriverRatingSummary = {
  /** One decimal; null before the first rating. */
  average: number | null;
  count: number;
  recentComments: DriverRating[];
};

export function fetchMyRatingSummary(): Promise<DriverRatingSummary> {
  return apiGet<DriverRatingSummary>('/api/deliveries/me/rating-summary', true);
}
