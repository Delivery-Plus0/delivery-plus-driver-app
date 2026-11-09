import { describe, expect, it } from 'vitest';

import { ApiError } from '@/services/api';
import type { DriverApplication } from '@/services/drivers';

import {
  canEditApplication,
  describeApplicationError,
  displayDate,
  documentContentType,
  expiryError,
  licenceWarning,
  missingItems,
  nationalIdError,
  parseDate,
} from './driver-application';

const application = (overrides: Partial<DriverApplication> = {}): DriverApplication => ({
  driverId: 'd1',
  status: 'DRAFT',
  submittedAt: null,
  verificationNote: null,
  nationalIdLast4: null,
  drivingLicenceExpiresOn: null,
  vehicleLicenceExpiresOn: null,
  documents: [],
  missingDocuments: ['national-id-front', 'national-id-back', 'driving-licence', 'vehicle-licence', 'selfie'],
  canSubmit: false,
  ...overrides,
});

describe('driver application helpers (#46)', () => {
  it('lets a draft or a rejected application change, not one under review or approved', () => {
    expect(canEditApplication('DRAFT')).toBe(true);
    expect(canEditApplication('REJECTED')).toBe(true);
    expect(canEditApplication('SUBMITTED')).toBe(false);
    expect(canEditApplication('VERIFIED')).toBe(false);
  });

  it('checks the national ID like the backend: 14 digits starting with 2 or 3', () => {
    expect(nationalIdError('2900101 1234567')).toBeUndefined();
    expect(nationalIdError('39001011234567')).toBeUndefined();
    expect(nationalIdError('19001011234567')).toBeDefined();
    expect(nationalIdError('2900101123456')).toBeDefined();
    expect(nationalIdError('')).toBeDefined();
  });

  it('reads dates as day/month/year or ISO, with Arabic digits, and refuses impossible ones', () => {
    expect(parseDate('31/05/2028')).toBe('2028-05-31');
    expect(parseDate('1.6.2027')).toBe('2027-06-01');
    expect(parseDate('2028-05-31')).toBe('2028-05-31');
    expect(parseDate('٣١/٠٥/٢٠٢٨')).toBe('2028-05-31');
    expect(parseDate('31/02/2028')).toBeNull();
    expect(parseDate('2028/05')).toBeNull();
    expect(displayDate('2028-05-31')).toBe('31/05/2028');
  });

  it('accepts a licence valid today or later, up to 15 years', () => {
    const today = '2026-11-08';
    expect(expiryError('08/11/2026', today)).toBeUndefined();
    expect(expiryError('07/11/2026', today)).toMatch(/expired/);
    expect(expiryError('09/11/2042', today)).toMatch(/15 years/);
    expect(expiryError('', today)).toBeDefined();
    expect(expiryError('soon', today)).toMatch(/day\/month\/year/);
  });

  it('uploads photos as JPEG or PNG only', () => {
    expect(documentContentType('image/jpeg')).toBe('image/jpeg');
    expect(documentContentType('image/png')).toBe('image/png');
    expect(documentContentType('image/webp')).toBeNull();
  });

  it('lists what stops a submit, including an expired licence', () => {
    expect(missingItems(application(), '2026-11-08')).toHaveLength(8);
    const ready = application({
      nationalIdLast4: '4567',
      drivingLicenceExpiresOn: '2026-11-01',
      vehicleLicenceExpiresOn: '2028-01-01',
      missingDocuments: ['selfie'],
    });
    expect(missingItems(ready, '2026-11-08')).toEqual(['A valid Driving licence (this one has expired)', 'Selfie']);
  });

  it('warns about the soonest licence expiry', () => {
    expect(licenceWarning(application(), '2026-11-08')).toBeNull();
    expect(licenceWarning(application({ expiringLicences: [{ field: 'vehicleLicenceExpiresOn', expiresOn: '2026-11-20' }] }), '2026-11-08')).toBe(
      'Your Vehicle licence expires on 20/11/2026. Renew it before then to keep driving.',
    );
    expect(licenceWarning(application({ expiringLicences: [{ field: 'drivingLicenceExpiresOn', expiresOn: '2026-11-08' }] }), '2026-11-08')).toMatch(/expires today/);
  });

  it('explains the application errors', () => {
    expect(describeApplicationError(new ApiError(409, 'NationalIdAlreadyRegistered', 'raw'), 'f')).toMatch(/already registered/);
    expect(describeApplicationError(new ApiError(409, 'DocumentVersionLimitReached', 'raw'), 'f')).toMatch(/too many times/);
    expect(describeApplicationError(new ApiError(400, 'BadRequest', 'Server message'), 'f')).toBe('Server message');
  });
});
