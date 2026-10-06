import { apiPost } from '@/services/api';
import type { Position } from '@/utils/location-sharing';

/**
 * POST /api/tracking/location (tracking-service, DRIVER only). Which driver is moving, and which
 * delivery the report belongs to, come from the token server-side (#60); only the position and when it
 * was captured are sent.
 */
export async function reportLocation(position: Position): Promise<void> {
  const body: Position = { latitude: position.latitude, longitude: position.longitude };
  if (position.recordedAt) body.recordedAt = position.recordedAt;
  await apiPost<unknown>('/api/tracking/location', body, true);
}
