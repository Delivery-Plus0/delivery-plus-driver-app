import type { BadgeTone } from '@/components/ui/badge';
import { ApiError } from '@/services/api';
import type { ApplicationStatus, DocumentContentType, DriverApplication, DriverDocumentType, LicenceField } from '@/services/drivers';
import { t } from '@/i18n/core';

/** What the driver photographs, in the order the screen asks for it (#46). */
export const DOCUMENTS: Record<DriverDocumentType, { label: string; hint: string }> = {
  'national-id-front': { get label() { return t('National ID, front'); }, get hint() { return t('The side with your photo. All four corners in the frame.'); } },
  'national-id-back': { get label() { return t('National ID, back'); }, get hint() { return t('The side with the address and expiry date.'); } },
  'driving-licence': { get label() { return t('Driving licence'); }, get hint() { return t('Your personal licence, readable and not expired.'); } },
  'vehicle-licence': { get label() { return t('Vehicle licence'); }, get hint() { return t('The licence of the vehicle you deliver with.'); } },
  selfie: { get label() { return t('Selfie'); }, get hint() { return t('Your face, clearly lit, without sunglasses or a cap.'); } },
};

export const APPLICATION_META: Record<ApplicationStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { get label() { return t('Not submitted'); }, tone: 'neutral' },
  SUBMITTED: { get label() { return t('Under review'); }, tone: 'warning' },
  VERIFIED: { get label() { return t('Approved'); }, tone: 'success' },
  REJECTED: { get label() { return t('Changes needed'); }, tone: 'danger' },
};

export const LICENCE_LABELS: Record<LicenceField, string> = {
  get drivingLicenceExpiresOn() { return t('Driving licence'); },
  get vehicleLicenceExpiresOn() { return t('Vehicle licence'); },
};

/** The driver can change the application and submit it: a draft, or a rejected one to resubmit. */
export function canEditApplication(status: ApplicationStatus): boolean {
  return status === 'DRAFT' || status === 'REJECTED';
}

/** The 14-digit Egyptian national ID: starts with 2 or 3 (the century of birth). Spaces are ignored. */
export function nationalIdError(value: string): string | undefined {
  const digits = value.replace(/\s/g, '');
  if (!digits) return t('Enter your national ID number');
  return /^[23]\d{13}$/.test(digits) ? undefined : t('Enter the 14 digits of your national ID');
}

/** The calendar date in Cairo, YYYY-MM-DD: licence dates are Cairo dates. */
export function cairoToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/**
 * A date typed as day/month/year (how Egyptian licences print it) or YYYY-MM-DD, as YYYY-MM-DD; null
 * when it isn't a real calendar date. Eastern Arabic digits are accepted too.
 */
export function parseDate(value: string): string | null {
  const latin = value.trim().replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
  let year: number;
  let month: number;
  let day: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(latin);
  if (match) [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(latin);
    if (!match) return null;
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** A licence expiry: a real date, not already past in Cairo, at most 15 years ahead (the backend's rules). */
export function expiryError(value: string, today = cairoToday()): string | undefined {
  if (!value.trim()) return t('Enter the expiry date');
  const date = parseDate(value);
  if (!date) return t('Enter the date as day/month/year, e.g. 31/05/2028');
  if (date < today) return t('This licence has expired. Renew it before you apply.');
  const latest = `${Number(today.slice(0, 4)) + 15}${today.slice(4)}`;
  if (date > latest) return t('Check the year: that is more than 15 years away.');
  return undefined;
}

/** "2028-05-31" → "31/05/2028", as printed on the licence. */
export function displayDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/** The documents the backend accepts are JPEG, PNG or PDF; the app sends photos, so JPEG or PNG. */
export function documentContentType(mimeType: string): DocumentContentType | null {
  return mimeType === 'image/jpeg' || mimeType === 'image/png' ? mimeType : null;
}

/** What still stops a submit, as labels, from the backend's own view of the application. */
export function missingItems(application: DriverApplication, today = cairoToday()): string[] {
  const missing: string[] = [];
  if (!application.nationalIdLast4) missing.push(t('Your national ID number'));
  for (const field of ['drivingLicenceExpiresOn', 'vehicleLicenceExpiresOn'] as const) {
    const value = application[field];
    if (!value) missing.push(t('The {licence} expiry date', { licence: LICENCE_LABELS[field] }));
    else if (value < today) missing.push(t('A valid {licence} (this one has expired)', { licence: LICENCE_LABELS[field] }));
  }
  for (const type of application.missingDocuments) missing.push(DOCUMENTS[type].label);
  return missing;
}

/** The licence banner for a driver on the road: what expires soon, soonest first; null when nothing does. */
export function licenceWarning(application: Pick<DriverApplication, 'expiringLicences'> | null | undefined, today = cairoToday()): string | null {
  const soonest = application?.expiringLicences?.[0];
  if (!soonest) return null;
  const days = Math.round((Date.parse(`${soonest.expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  const licence = LICENCE_LABELS[soonest.field];
  if (days <= 0) return t('Your {licence} expires today. Renew it to keep driving.', { licence });
  return t('Your {licence} expires on {date}. Renew it before then to keep driving.', { licence, date: displayDate(soonest.expiresOn) });
}

/** A readable message for the backend's application errors; anything else keeps its own message. */
export function describeApplicationError(caught: unknown, fallback: string): string {
  if (!(caught instanceof ApiError)) return caught instanceof Error && caught.message ? caught.message : fallback;
  switch (caught.error) {
    case 'NationalIdAlreadyRegistered':
      return t('This national ID is already registered to another driver account. Contact support if it is yours.');
    case 'ApplicationNotEditable':
      return t('Your application is with our team and can no longer be changed.');
    case 'ApplicationIncomplete':
      return t('Some details are still missing. Check the list below.');
    case 'DocumentVersionLimitReached':
      return t('You have replaced this document too many times. Contact support.');
    case 'TooManyRequests':
      return t('Too many uploads in a short time. Wait a little and try again.');
    default:
      return caught.message || fallback;
  }
}
