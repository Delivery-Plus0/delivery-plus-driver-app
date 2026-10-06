import { describe, expect, it } from 'vitest';

import { directionsUrl } from './maps';

describe('directionsUrl', () => {
  it('uses coordinates when both are present', () => {
    expect(directionsUrl({ latitude: 30.0444, longitude: 31.2357, address: '1 Test Street' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=30.0444%2C31.2357',
    );
  });

  it('falls back to the address, URL-encoded', () => {
    expect(directionsUrl({ latitude: null, longitude: 31.2, address: ' QA Kitchen, 1 Test Street & Co ' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=QA%20Kitchen%2C%201%20Test%20Street%20%26%20Co',
    );
  });

  it('accepts zero coordinates', () => {
    expect(directionsUrl({ latitude: 0, longitude: 0 })).toBe('https://www.google.com/maps/dir/?api=1&destination=0%2C0');
  });

  it('is null when there is nothing to navigate to', () => {
    expect(directionsUrl({ latitude: null, longitude: null, address: null })).toBeNull();
    expect(directionsUrl({ address: '   ' })).toBeNull();
    expect(directionsUrl({ latitude: Number.NaN, longitude: 1 })).toBeNull();
  });
});
