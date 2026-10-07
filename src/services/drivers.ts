import { ApiError, apiGet, apiPatch, apiPost } from '@/services/api';

/** driver-service statuses. A driver moves only OFFLINE ↔ AVAILABLE; the backend sets BUSY on assignment. */
export type DriverStatus = 'OFFLINE' | 'AVAILABLE' | 'BUSY' | 'SUSPENDED';

export type Driver = {
  id: string;
  userId: string;
  vehicleType: string;
  licensePlate: string;
  status: DriverStatus;
  /** Set by an admin (#147); new drivers start PENDING. */
  verificationStatus?: VerificationStatus;
  /** The admin's note to the driver, e.g. why the review failed. */
  verificationNote?: string | null;
  verifiedAt?: string | null;
};

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type RegisterVehicleRequest = {
  vehicleType: string;
  licensePlate: string;
};

/** The signed-in driver's profile, or `null` before the vehicle is registered (driver-service answers 404). */
export async function fetchMyDriver(): Promise<Driver | null> {
  try {
    return await apiGet<Driver>('/api/drivers/me', true);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) return null;
    throw error;
  }
}

/** First use: creates the driver profile (POST /drivers/register, DRIVER role only). */
export async function registerVehicle(payload: RegisterVehicleRequest): Promise<Driver> {
  return apiPost<Driver>('/api/drivers/register', payload, true);
}

/** OFFLINE → AVAILABLE. Repeating it while AVAILABLE is a no-op; while BUSY it answers 403. */
export async function goOnline(): Promise<Driver> {
  return apiPost<Driver>('/api/drivers/me/online', {}, true);
}

/** AVAILABLE → OFFLINE. Not possible while BUSY on a delivery (409). */
export async function goOffline(): Promise<Driver> {
  return apiPost<Driver>('/api/drivers/me/offline', {}, true);
}

/** PATCH /drivers/me/vehicle (#147): only while OFFLINE, otherwise 409. The plate is stored upper-case. */
export async function updateVehicle(payload: RegisterVehicleRequest): Promise<Driver> {
  return apiPatch<Driver>('/api/drivers/me/vehicle', payload, true);
}
