import { apiDelete, apiGet, apiPatch, apiPost } from '@/services/api';
import type { PresignedUpload } from '@/utils/image-upload';

/**
 * The driver's own account in user-service (#147): name, phone and photo. The vehicle and verification
 * live in driver-service. Customers only ever see the driver's first name, photo, vehicle and plate.
 */
export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
};

/** Mirrors user-service `UpdateProfileDto`; email is owned by auth-service and not editable here. */
export type UpdateProfileRequest = {
  fullName?: string;
  phone?: string;
};

export async function fetchMyProfile(): Promise<UserProfile> {
  return apiGet<UserProfile>('/api/users/me', true);
}

export async function updateMyProfile(payload: UpdateProfileRequest): Promise<UserProfile> {
  return apiPatch<UserProfile>('/api/users/me', payload, true);
}

/** Profile photo: presign, upload straight to storage, confirm; or remove it. */
export async function createAvatarUploadUrl(contentType: string): Promise<PresignedUpload> {
  return apiPost<PresignedUpload>('/api/users/me/avatar/image-upload-url', { contentType }, true);
}

export async function confirmAvatarUpload(objectKey: string): Promise<UserProfile> {
  return apiPost<UserProfile>('/api/users/me/avatar/confirm', { objectKey }, true);
}

export async function removeMyAvatar(): Promise<UserProfile> {
  return apiDelete<UserProfile>('/api/users/me/avatar', true);
}
