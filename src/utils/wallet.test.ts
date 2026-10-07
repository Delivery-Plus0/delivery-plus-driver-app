import { describe, expect, it } from 'vitest';

import { earningStatus, earningTypeLabel, settlementNote } from './wallet';

describe('earningTypeLabel', () => {
  it('names each ledger entry type', () => {
    expect(earningTypeLabel({ type: 'DELIVERY_EARNING' })).toBe('Delivery');
    expect(earningTypeLabel({ type: 'CANCELLATION_COMPENSATION' })).toBe('Cancelled after pickup');
    expect(earningTypeLabel({ type: 'REVERSAL' })).toBe('Correction');
  });
});

describe('earningStatus', () => {
  it("shows the backend's status", () => {
    expect(earningStatus({ status: 'PENDING' })).toEqual({ label: 'Pending', tone: 'warning' });
    expect(earningStatus({ status: 'AVAILABLE' })).toEqual({ label: 'Available', tone: 'success' });
  });
});

describe('settlementNote', () => {
  it('states the settlement window from the backend', () => {
    expect(settlementNote(12)).toBe('Earnings become available 12 hours after each delivery.');
    expect(settlementNote(1)).toBe('Earnings become available 1 hour after each delivery.');
    expect(settlementNote(0)).toBe('Earnings are available as soon as a delivery is finished.');
  });
});
