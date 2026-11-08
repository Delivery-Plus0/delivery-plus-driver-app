import { useResource } from '@/hooks/use-resource';
import {
  fetchCurrentDelivery,
  fetchDeliveryHistory,
  performDeliveryAction,
  type CurrentDelivery,
  type DeliveryAction,
  type DriverHistoryPage,
  type HistoryFilter,
} from '@/services/deliveries';
import {
  confirmDocumentUpload,
  createDocumentUpload,
  fetchMyApplication,
  fetchMyDriver,
  goOffline,
  goOnline,
  registerVehicle,
  saveMyApplication,
  submitMyApplication,
  updateVehicle,
  type Driver,
  type DriverApplication,
  type DriverDocumentType,
  type RegisterVehicleRequest,
  type SaveApplicationRequest,
} from '@/services/drivers';
import { fetchMyEarnings, type DriverEarnings } from '@/services/earnings';
import { fetchMyRatingSummary, type DriverRatingSummary } from '@/services/ratings';
import {
  confirmAvatarUpload,
  createAvatarUploadUrl,
  fetchMyProfile,
  removeMyAvatar,
  startPhoneVerification,
  updateMyProfile,
  verifyPhone,
  type PhoneVerificationStarted,
  type UpdateProfileRequest,
  type UserProfile,
} from '@/services/users';
import { fetchResource, setResourceData } from '@/state/resource-cache';
import { isOnShift } from '@/utils/driver-status';
import { documentContentType } from '@/utils/driver-application';
import { t } from '@/i18n/core';
import { pickImage, uploadToPresigned } from '@/utils/image-upload';

const DRIVER_KEY = 'driver:me';
const CURRENT_DELIVERY_KEY = 'delivery:current';
const historyKey = (filter: HistoryFilter | null) => `delivery:history:${filter ?? 'all'}`;
const COMPLETED_TODAY_KEY = 'delivery:history:today';
const EARNINGS_KEY = 'driver:earnings';
const PROFILE_KEY = 'profile';
const APPLICATION_KEY = 'driver:application';

/** Newest completed deliveries fetched for the Today count; the backend allows up to 50 per page. */
export const COMPLETED_TODAY_PAGE = 50;

/** While on shift, check for a newly assigned delivery (and status changes) this often. */
export const ON_SHIFT_POLL_MS = 5_000;

/** The signed-in driver's profile; `null` until the vehicle is registered. Polled while on shift. */
export function useMyDriver() {
  return useResource<Driver | null>(DRIVER_KEY, fetchMyDriver, {
    staleTimeMs: 2_000,
    pollIntervalMs: (driver) => (isOnShift(driver?.status) ? ON_SHIFT_POLL_MS : 0),
  });
}

/**
 * The delivery assigned to this driver, or `null` (waiting for a job). Only fetched while on shift.
 * Polling for now; a push channel can replace this hook later without changing the screen.
 */
export function useCurrentDelivery(driver: Driver | null | undefined) {
  return useResource<CurrentDelivery | null>(isOnShift(driver?.status) ? CURRENT_DELIVERY_KEY : null, fetchCurrentDelivery, {
    staleTimeMs: 2_000,
    pollIntervalMs: ON_SHIFT_POLL_MS,
  });
}

/** First page of the driver's history for a filter (#142); later pages are loaded by the screen. */
export function useDeliveryHistory(filter: HistoryFilter | null) {
  return useResource<DriverHistoryPage>(historyKey(filter), () => fetchDeliveryHistory(filter), { staleTimeMs: 10_000 });
}

/** The newest completed deliveries, for "N deliveries completed today" on the Today tab. */
export function useCompletedTodayPage() {
  return useResource<DriverHistoryPage>(COMPLETED_TODAY_KEY, () => fetchDeliveryHistory('completed', 1, COMPLETED_TODAY_PAGE), {
    staleTimeMs: 30_000,
  });
}

/** The driver's rating from customers (#144): average, count and recent comments, from the backend. */
export function useMyRatingSummary() {
  return useResource<DriverRatingSummary>('driver:rating-summary', fetchMyRatingSummary, { staleTimeMs: 60_000 });
}

/** The driver's earnings from the backend ledger (#145/#146): totals and the newest entries. */
export function useMyEarnings() {
  return useResource<DriverEarnings>(EARNINGS_KEY, () => fetchMyEarnings(), { staleTimeMs: 30_000 });
}

/** The driver's account in user-service (#147): name, phone, photo. */
export function useMyProfile() {
  return useResource<UserProfile>(PROFILE_KEY, fetchMyProfile, { staleTimeMs: 60_000 });
}

export async function saveMyProfile(changes: UpdateProfileRequest): Promise<UserProfile> {
  const profile = await updateMyProfile(changes);
  setResourceData<UserProfile>(PROFILE_KEY, profile);
  return profile;
}

/** user-service's avatar policy is 5 MB. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Uploads a new photo (customers see it on the driver card) and shows the server's profile right away. */
export async function changeMyAvatar(source: 'library' | 'camera'): Promise<UserProfile | null> {
  const picked = await pickImage(source, AVATAR_MAX_BYTES);
  if (!picked) return null;
  const presigned = await createAvatarUploadUrl(picked.mimeType);
  await uploadToPresigned(presigned, picked);
  const profile = await confirmAvatarUpload(presigned.objectKey);
  setResourceData<UserProfile>(PROFILE_KEY, profile);
  return profile;
}

export async function removeMyPhoto(): Promise<UserProfile> {
  const profile = await removeMyAvatar();
  setResourceData<UserProfile>(PROFILE_KEY, profile);
  return profile;
}

/** Texts a verification code to the profile phone (#153). */
export async function sendPhoneCode(): Promise<PhoneVerificationStarted> {
  return startPhoneVerification();
}

/** Confirms the code; the verified profile is shown right away. */
export async function confirmPhoneCode(code: string): Promise<UserProfile> {
  const profile = await verifyPhone(code);
  setResourceData<UserProfile>(PROFILE_KEY, profile);
  return profile;
}

/** Changes the vehicle (#147); the backend refuses it unless the driver is offline. */
export async function updateMyVehicle(payload: RegisterVehicleRequest): Promise<Driver> {
  const driver = await updateVehicle(payload);
  setResourceData<Driver | null>(DRIVER_KEY, driver);
  return driver;
}

export async function registerMyVehicle(payload: RegisterVehicleRequest): Promise<Driver> {
  const driver = await registerVehicle(payload);
  setResourceData<Driver | null>(DRIVER_KEY, driver);
  return driver;
}

export async function setOnline(online: boolean): Promise<Driver> {
  const driver = online ? await goOnline() : await goOffline();
  setResourceData<Driver | null>(DRIVER_KEY, driver);
  return driver;
}

/** Performs the action, then refreshes both the delivery and the driver (completing frees the driver). */
export async function advanceDelivery(deliveryId: string, action: DeliveryAction): Promise<void> {
  await performDeliveryAction(deliveryId, action);
  await Promise.all([fetchResource(CURRENT_DELIVERY_KEY, fetchCurrentDelivery), fetchResource(DRIVER_KEY, fetchMyDriver)]);
  if (action === 'complete') {
    // The finished job now belongs in the Today count; the History tab revalidates when opened.
    void fetchResource(COMPLETED_TODAY_KEY, () => fetchDeliveryHistory('completed', 1, COMPLETED_TODAY_PAGE)).catch(() => undefined);
    // The new earning is in the ledger now (#145); refresh the Wallet's copy.
    void fetchResource(EARNINGS_KEY, () => fetchMyEarnings()).catch(() => undefined);
  }
}

/**
 * The driver's application (#46, backend #207), once the vehicle is registered. Shown in full while it
 * can be edited; read for the licence banner afterwards.
 */
export function useMyApplication(driver: Driver | null | undefined) {
  return useResource<DriverApplication>(driver ? APPLICATION_KEY : null, fetchMyApplication, { staleTimeMs: 10_000 });
}

/** Saves the national ID and licence dates; the backend keeps only the ID's last 4 digits and a hash. */
export async function saveApplicationDetails(payload: SaveApplicationRequest): Promise<DriverApplication> {
  const application = await saveMyApplication(payload);
  setResourceData<DriverApplication>(APPLICATION_KEY, application);
  return application;
}

/**
 * Photographs (camera) or picks (library) one document, uploads it straight to private storage and
 * asks the backend to check it. Returns null when the driver cancels. Retrying after a failure starts
 * over with a fresh upload, which is safe: only a confirmed upload becomes the document.
 */
export async function uploadDocument(type: DriverDocumentType, source: 'camera' | 'library'): Promise<DriverApplication | null> {
  const picked = await pickImage(source);
  if (!picked) return null;
  const contentType = documentContentType(picked.mimeType);
  if (!contentType) throw new Error(t('Choose a JPEG or PNG photo.'));
  const presigned = await createDocumentUpload(type, contentType);
  await uploadToPresigned(presigned, picked);
  const application = await confirmDocumentUpload(type, presigned.objectKey);
  setResourceData<DriverApplication>(APPLICATION_KEY, application);
  return application;
}

/** Sends the application for review; the driver profile is refreshed too (its verification note clears). */
export async function submitApplication(): Promise<DriverApplication> {
  const application = await submitMyApplication();
  setResourceData<DriverApplication>(APPLICATION_KEY, application);
  await fetchResource(DRIVER_KEY, fetchMyDriver).catch(() => undefined);
  return application;
}

/** Re-reads the application and the driver, e.g. when the screen opens again after a review. */
export async function reloadApplication(): Promise<void> {
  await Promise.all([fetchResource(APPLICATION_KEY, fetchMyApplication), fetchResource(DRIVER_KEY, fetchMyDriver)]);
}

