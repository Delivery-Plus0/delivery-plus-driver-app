import { describe, expect, it } from 'vitest';

import { ACTION_CONFIRMATIONS, ACTION_LABELS, canToggleOnline, isOnShift, nextAction } from './driver-status';

describe('driver status helpers', () => {
  it('lets the driver toggle only between OFFLINE and AVAILABLE', () => {
    expect(canToggleOnline('OFFLINE')).toBe(true);
    expect(canToggleOnline('AVAILABLE')).toBe(true);
    expect(canToggleOnline('BUSY')).toBe(false);
    expect(canToggleOnline('SUSPENDED')).toBe(false);
  });

  it('treats AVAILABLE and BUSY as on shift (deliveries are polled)', () => {
    expect(isOnShift('AVAILABLE')).toBe(true);
    expect(isOnShift('BUSY')).toBe(true);
    expect(isOnShift('OFFLINE')).toBe(false);
    expect(isOnShift('SUSPENDED')).toBe(false);
    expect(isOnShift(undefined)).toBe(false);
  });

  it('takes the next action from the backend, or none', () => {
    expect(nextAction({ nextActions: ['pickup'] })).toBe('pickup');
    expect(nextAction({ nextActions: [] })).toBeNull();
    expect(nextAction(null)).toBeNull();
    expect(nextAction(undefined)).toBeNull();
  });

  it('asks for confirmation before every delivery action', () => {
    for (const action of Object.keys(ACTION_LABELS) as (keyof typeof ACTION_LABELS)[]) {
      const confirmation = ACTION_CONFIRMATIONS[action];
      expect(confirmation.title).not.toBe('');
      expect(confirmation.message).not.toBe('');
      expect(confirmation.confirmLabel).not.toBe('');
    }
  });
});
