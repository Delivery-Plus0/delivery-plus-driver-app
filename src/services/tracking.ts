import { apiPost } from '@/services/api';
import type { Position } from '@/utils/location-sharing';

/** POST /api/tracking/location (tracking-service, DRIVER only). Which driver is moving comes from the token. */
export async function reportLocation(position: Position): Promise<void> {
  await apiPost<unknown>('/api/tracking/location', { latitude: position.latitude, longitude: position.longitude }, true);
}
