import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseFixedLocation, shouldShareLocation, startLocationSharing, type LocationSharingState } from './location-sharing';

const CAIRO = { latitude: 30.0444, longitude: 31.2357 };

describe('shouldShareLocation', () => {
  it('shares from assignment until the order is handed over', () => {
    expect(shouldShareLocation('DRIVER_ASSIGNED')).toBe(true);
    expect(shouldShareLocation('PICKED_UP')).toBe(true);
    expect(shouldShareLocation('IN_TRANSIT')).toBe(true);
    expect(shouldShareLocation('CREATED')).toBe(false);
    expect(shouldShareLocation('DELIVERED')).toBe(false);
    expect(shouldShareLocation('CANCELLED')).toBe(false);
    expect(shouldShareLocation(undefined)).toBe(false);
  });
});

describe('parseFixedLocation', () => {
  it('reads "lat,lng"', () => {
    expect(parseFixedLocation('30.0444,31.2357')).toEqual(CAIRO);
    expect(parseFixedLocation(' -33.9 , 18.4 ')).toEqual({ latitude: -33.9, longitude: 18.4 });
  });

  it('ignores unset, malformed and out-of-range values', () => {
    expect(parseFixedLocation(undefined)).toBeNull();
    expect(parseFixedLocation('')).toBeNull();
    expect(parseFixedLocation('30.0444')).toBeNull();
    expect(parseFixedLocation('30,31,32')).toBeNull();
    expect(parseFixedLocation('north,east')).toBeNull();
    expect(parseFixedLocation(',31')).toBeNull();
    expect(parseFixedLocation('91,0')).toBeNull();
    expect(parseFixedLocation('0,181')).toBeNull();
  });
});

describe('startLocationSharing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(overrides: { granted?: boolean; getPosition?: () => Promise<typeof CAIRO>; report?: () => Promise<void> } = {}) {
    const states: LocationSharingState[] = [];
    const report = vi.fn(overrides.report ?? (async () => {}));
    const getPosition = vi.fn(overrides.getPosition ?? (async () => CAIRO));
    const stop = startLocationSharing(
      { requestPermission: async () => overrides.granted ?? true, getPosition, report, intervalMs: 10_000 },
      (state) => states.push(state),
    );
    return { states, report, getPosition, stop };
  }

  it('sends the position at once, then on every interval, until stopped', async () => {
    const { states, report, stop } = setup();

    await vi.advanceTimersByTimeAsync(0);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenLastCalledWith(CAIRO);
    expect(states).toEqual(['starting', 'sharing']);

    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(report).toHaveBeenCalledTimes(3);

    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(report).toHaveBeenCalledTimes(3);
  });

  it('never reads the position when permission is refused', async () => {
    const { states, getPosition, report } = setup({ granted: false });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(states).toEqual(['starting', 'denied']);
    expect(getPosition).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it('reports a failed send as unavailable and recovers on the next tick', async () => {
    let fail = true;
    const { states, report } = setup({
      report: async () => {
        if (fail) throw new Error('offline');
      },
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(states.at(-1)).toBe('unavailable');

    fail = false;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(report).toHaveBeenCalledTimes(2);
    expect(states).toEqual(['starting', 'unavailable', 'sharing']);
  });

  it('does not emit after stop, even if a send was in flight', async () => {
    let finish: () => void = () => {};
    const { states, stop } = setup({ report: () => new Promise<void>((resolve) => (finish = resolve)) });

    await vi.advanceTimersByTimeAsync(0);
    stop();
    finish();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(states).toEqual(['starting']);
  });
});
