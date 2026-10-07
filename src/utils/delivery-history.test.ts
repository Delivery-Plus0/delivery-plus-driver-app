import { describe, expect, it } from 'vitest';

import type { DriverHistoryItem } from '@/services/deliveries';

import {
  completedToday,
  completedTodayLabel,
  deliveryDuration,
  finishedAt,
  historyStatus,
  historyTimeline,
  mergeHistoryPages,
} from './delivery-history';

const item = (overrides: Partial<DriverHistoryItem> = {}): DriverHistoryItem => ({
  id: 'd-1',
  orderId: 'o-1',
  status: 'DELIVERED',
  assignedAt: '2026-10-07T10:00:00.000Z',
  pickedUpAt: '2026-10-07T10:10:00.000Z',
  deliveredAt: '2026-10-07T10:23:00.000Z',
  cancelledAt: null,
  updatedAt: '2026-10-07T10:23:00.000Z',
  restaurant: { id: 'r-1', name: 'QA Kitchen' },
  order: { items: [{ name: 'QA Burger', quantity: 1 }], totalAmount: '9.99', dropOffAddress: '1 Test Street' },
  ...overrides,
});

describe('historyStatus', () => {
  it('names finished outcomes and the current job', () => {
    expect(historyStatus({ status: 'DELIVERED' })).toEqual({ label: 'Delivered', tone: 'success' });
    expect(historyStatus({ status: 'CANCELLED' })).toEqual({ label: 'Cancelled', tone: 'danger' });
    expect(historyStatus({ status: 'PICKED_UP' })).toEqual({ label: 'In progress', tone: 'brand' });
  });
});

describe('historyTimeline', () => {
  it('lists the recorded stages in order', () => {
    expect(historyTimeline(item()).map((row) => row.label)).toEqual(['Assigned', 'Picked up', 'Delivered']);
  });

  it('leaves out stages without a recorded time instead of guessing', () => {
    const cancelled = item({ status: 'CANCELLED', pickedUpAt: null, deliveredAt: null, cancelledAt: '2026-10-07T10:05:00.000Z' });
    expect(historyTimeline(cancelled).map((row) => row.label)).toEqual(['Assigned', 'Cancelled']);
  });
});

describe('finishedAt', () => {
  it('prefers the delivered or cancelled time, else the last update', () => {
    expect(finishedAt(item())).toBe('2026-10-07T10:23:00.000Z');
    expect(finishedAt(item({ deliveredAt: null, cancelledAt: '2026-10-07T11:00:00.000Z' }))).toBe('2026-10-07T11:00:00.000Z');
    expect(finishedAt(item({ deliveredAt: null, updatedAt: '2026-10-07T12:00:00.000Z' }))).toBe('2026-10-07T12:00:00.000Z');
  });
});

describe('deliveryDuration', () => {
  it('measures assignment to delivery', () => {
    expect(deliveryDuration(item())).toBe('Took 23 min');
    expect(deliveryDuration(item({ deliveredAt: '2026-10-07T10:00:20.000Z' }))).toBe('Took under a minute');
  });

  it('is null without both times', () => {
    expect(deliveryDuration(item({ deliveredAt: null }))).toBeNull();
    expect(deliveryDuration(item({ assignedAt: null }))).toBeNull();
  });
});

describe('mergeHistoryPages', () => {
  it('joins pages and drops a row repeated on the next page', () => {
    const merged = mergeHistoryPages([[item({ id: 'a' }), item({ id: 'b' })], [item({ id: 'b' }), item({ id: 'c' })]]);
    expect(merged.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('completedToday', () => {
  const now = new Date('2026-10-07T18:00:00');
  const today = (id: string) => item({ id, deliveredAt: new Date('2026-10-07T09:00:00').toISOString() });
  const yesterday = (id: string) => item({ id, deliveredAt: new Date('2026-10-06T22:00:00').toISOString() });

  it("counts only today's deliveries", () => {
    expect(completedToday([today('a'), today('b'), yesterday('c')], 50, now)).toEqual({ count: 2, atLeast: false });
  });

  it('is a lower bound when the whole full page is from today', () => {
    expect(completedToday([today('a'), today('b')], 2, now)).toEqual({ count: 2, atLeast: true });
  });

  it('reads naturally', () => {
    expect(completedTodayLabel({ count: 0, atLeast: false })).toBe('No deliveries completed yet today');
    expect(completedTodayLabel({ count: 1, atLeast: false })).toBe('1 delivery completed today');
    expect(completedTodayLabel({ count: 3, atLeast: false })).toBe('3 deliveries completed today');
    expect(completedTodayLabel({ count: 50, atLeast: true })).toBe('50+ deliveries completed today');
  });
});
