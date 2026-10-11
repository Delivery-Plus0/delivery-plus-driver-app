import type { BadgeTone } from '@/components/ui/badge';
import type { DriverStatus, VerificationStatus } from '@/services/drivers';
import { EGYPTIAN_MOBILE_MESSAGE, normalizeEgyptianMobile } from '@/utils/phone';
import { t } from '@/i18n/core';

/** How the driver's review (#147) reads on the Profile tab. */
export const VERIFICATION_META: Record<VerificationStatus, { label: string; tone: BadgeTone; message: string }> = {
  PENDING: { get label() { return t('In review'); }, tone: 'warning', get message() { return t('Delivery Plus is reviewing your account.'); } },
  VERIFIED: { get label() { return t('Verified'); }, tone: 'success', get message() { return t('Your account is verified.'); } },
  REJECTED: { get label() { return t('Not approved'); }, tone: 'danger', get message() { return t('Your account was not approved. Contact support to fix it.'); } },
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
    vehicleType: type.length < 2 ? t('Enter your vehicle type (e.g. Scooter)') : type.length > 50 ? t('Use at most {max} characters', { max: 50 }) : undefined,
    licensePlate: plate.length < 2 ? t('Enter your license plate') : plate.length > 20 ? t('Use at most {max} characters', { max: 20 }) : undefined,
  };
}

/** Name is required; a phone is optional but must be an Egyptian mobile (#152). */
export function detailsProblems(fullName: string, phone: string): { fullName?: string; phone?: string } {
  return {
    fullName: fullName.trim().length < 2 ? t('Enter your full name') : undefined,
    phone: phone.trim() && !normalizeEgyptianMobile(phone) ? t(EGYPTIAN_MOBILE_MESSAGE) : undefined,
  };
}
