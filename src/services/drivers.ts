import { ApiError, apiGet, apiPatch, apiPost, apiPut } from '@/services/api';

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

// ---------------------------------------------------------------------------------------------
// Driver application (#46, backend #207): national ID, licence dates, five documents, review.
// ---------------------------------------------------------------------------------------------

export const DRIVER_DOCUMENT_TYPES = ['national-id-front', 'national-id-back', 'driving-licence', 'vehicle-licence', 'selfie'] as const;
export type DriverDocumentType = (typeof DRIVER_DOCUMENT_TYPES)[number];

/** DRAFT: fill in and submit. SUBMITTED: in the review queue. REJECTED: fix and resubmit. VERIFIED: can drive. */
export type ApplicationStatus = 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';

export type LicenceField = 'drivingLicenceExpiresOn' | 'vehicleLicenceExpiresOn';

/** Private documents accept JPEG, PNG or PDF (the app sends photos: JPEG or PNG). */
export type DocumentContentType = 'image/jpeg' | 'image/png' | 'application/pdf';

export type DriverApplication = {
  driverId: string;
  status: ApplicationStatus;
  submittedAt: string | null;
  verificationNote: string | null;
  lastReview?: { decision: 'VERIFIED' | 'REJECTED'; note: string | null; reviewedAt: string } | null;
  nationalIdLast4: string | null;
  drivingLicenceExpiresOn: string | null;
  vehicleLicenceExpiresOn: string | null;
  /** The current version of each uploaded document. Never a URL: documents are private. */
  documents: { type: DriverDocumentType; version: number; contentType: DocumentContentType; sizeBytes: number; uploadedAt: string }[];
  missingDocuments: DriverDocumentType[];
  canSubmit: boolean;
  /** Licences valid today that expire within 14 days (Cairo), soonest first. */
  expiringLicences?: { field: LicenceField; expiresOn: string }[];
};

export type SaveApplicationRequest = {
  /** The full 14-digit number; the backend keeps only its last 4 digits and a keyed hash. */
  nationalIdNumber: string;
  drivingLicenceExpiresOn: string;
  vehicleLicenceExpiresOn: string;
};

export type DocumentUpload = {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
  method: 'POST';
  fields: Record<string, string>;
};

export async function fetchMyApplication(): Promise<DriverApplication> {
  return apiGet<DriverApplication>('/api/drivers/me/application', true);
}

/** Draft or rejected only (409 ApplicationNotEditable, 409 NationalIdAlreadyRegistered). */
export async function saveMyApplication(payload: SaveApplicationRequest): Promise<DriverApplication> {
  return apiPut<DriverApplication>('/api/drivers/me/application', payload, true);
}

/** A presigned POST for one document (20 an hour). */
export async function createDocumentUpload(type: DriverDocumentType, contentType: DocumentContentType): Promise<DocumentUpload> {
  return apiPost<DocumentUpload>(`/api/drivers/me/documents/${type}/upload-url`, { contentType }, true);
}

/** The backend checks the file and makes it the document's current version (30 an hour). */
export async function confirmDocumentUpload(type: DriverDocumentType, objectKey: string): Promise<DriverApplication> {
  return apiPost<DriverApplication>(`/api/drivers/me/documents/${type}/confirm`, { objectKey }, true);
}

/** Sends a complete application for review, or resubmits a rejected one (422 ApplicationIncomplete). */
export async function submitMyApplication(): Promise<DriverApplication> {
  return apiPost<DriverApplication>('/api/drivers/me/application/submit', {}, true);
}
