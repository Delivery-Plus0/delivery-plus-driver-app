import { describe, expect, it } from 'vitest';

import { canEditVehicle, detailsProblems, VERIFICATION_META, vehicleProblems } from './driver-profile';

describe('canEditVehicle', () => {
  it('allows vehicle changes only while offline', () => {
    expect(canEditVehicle('OFFLINE')).toBe(true);
    expect(canEditVehicle('AVAILABLE')).toBe(false);
    expect(canEditVehicle('BUSY')).toBe(false);
    expect(canEditVehicle('SUSPENDED')).toBe(false);
    expect(canEditVehicle(undefined)).toBe(false);
  });
});

describe('vehicleProblems', () => {
  it('follows the backend limits', () => {
    expect(vehicleProblems('Scooter', 'ABC-123')).toEqual({ vehicleType: undefined, licensePlate: undefined });
    expect(vehicleProblems(' S ', '')).toEqual({ vehicleType: 'Enter your vehicle type (e.g. Scooter)', licensePlate: 'Enter your license plate' });
    expect(vehicleProblems('x'.repeat(51), 'y'.repeat(21))).toEqual({ vehicleType: 'Use at most 50 characters', licensePlate: 'Use at most 20 characters' });
  });
});

describe('detailsProblems', () => {
  it('needs a name and accepts no phone or an Egyptian mobile', () => {
    expect(detailsProblems('Omar Said', '')).toEqual({ fullName: undefined, phone: undefined });
    expect(detailsProblems('Omar Said', '010 1234 5678')).toEqual({ fullName: undefined, phone: undefined });
    expect(detailsProblems(' ', '')).toMatchObject({ fullName: 'Enter your full name' });
    expect(detailsProblems('Omar Said', '0223456789').phone).toMatch(/Egyptian mobile/);
  });
});

describe('VERIFICATION_META', () => {
  it('covers every status the backend sends', () => {
    expect(Object.keys(VERIFICATION_META).sort()).toEqual(['PENDING', 'REJECTED', 'VERIFIED']);
  });
});
