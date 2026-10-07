import type { BadgeTone } from '@/components/ui/badge';
import type { DriverStatus, VerificationStatus } from '@/services/drivers';
import { EGYPTIAN_MOBILE_MESSAGE, normalizeEgyptianMobile } from '@/utils/phone';

/** How the driver's review (#147) reads on the Profile tab. */
export const VERIFICATION_META: Record<VerificationStatus, { label: string; tone: BadgeTone; message: string }> = {
  PENDING: { label: 'In review', tone: 'warning', message: 'Delivery Plus is reviewing your account.' },
  VERIFIED: { label: 'Verified', tone: 'success', message: 'Your account is verified.' },
  REJECTED: { label: 'Not approved', tone: 'danger', message: 'Your account was not approved. Contact support to fix it.' },
};

/** The backend only accepts a vehicle change while the driver is offline (#147). */
export function canEditVehicle(status: DriverStatus | undefined): boolean {
  return status === 'OFFLINE';
}

/** Matches driver-service's UpdateVehicleDto: type 2-50 characters, plate 2-20. */
export function vehicleProblems(vehicleType: string, licensePlate: string): { vehicleType?: string; licensePlate?: string } {
  const type = vehicleType.trim();
  const plate = licensePlate.trim();
  return {
    vehicleType: type.length < 2 ? 'Enter your vehicle type (e.g. Scooter)' : type.length > 50 ? 'Use at most 50 characters' : undefined,
    licensePlate: plate.length < 2 ? 'Enter your license plate' : plate.length > 20 ? 'Use at most 20 characters' : undefined,
  };
}

/** Name is required; a phone is optional but must be an Egyptian mobile (#152). */
export function detailsProblems(fullName: string, phone: string): { fullName?: string; phone?: string } {
  return {
    fullName: fullName.trim().length < 2 ? 'Enter your full name' : undefined,
    phone: phone.trim() && !normalizeEgyptianMobile(phone) ? EGYPTIAN_MOBILE_MESSAGE : undefined,
  };
}
