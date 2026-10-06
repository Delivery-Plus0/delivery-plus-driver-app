import { describe, expect, it } from 'vitest';

import { DELIVERY_STEPS, deliveryProgressLabel, deliverySteps } from './delivery-steps';

const states = (status: Parameters<typeof deliverySteps>[0]) => deliverySteps(status).map((step) => step.state);

describe('deliverySteps', () => {
  it('lists the four driver steps in order', () => {
    expect(DELIVERY_STEPS.map((step) => step.label)).toEqual(['To restaurant', 'Picked up', 'On the way', 'Delivered']);
  });

  it('starts at "To restaurant" once the driver is assigned', () => {
    expect(states('DRIVER_ASSIGNED')).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('marks earlier steps done as the delivery moves forward', () => {
    expect(states('PICKED_UP')).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    expect(states('IN_TRANSIT')).toEqual(['done', 'done', 'current', 'upcoming']);
  });

  it('marks every step done when delivered', () => {
    expect(states('DELIVERED')).toEqual(['done', 'done', 'done', 'done']);
  });

  it('has no current step before assignment or after a cancellation', () => {
    expect(states('CREATED')).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming']);
    expect(states('CANCELLED')).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });
});

describe('deliveryProgressLabel', () => {
  it('names the current step and its position', () => {
    expect(deliveryProgressLabel('DRIVER_ASSIGNED')).toBe('Step 1 of 4 · To restaurant');
    expect(deliveryProgressLabel('PICKED_UP')).toBe('Step 2 of 4 · Picked up');
    expect(deliveryProgressLabel('IN_TRANSIT')).toBe('Step 3 of 4 · On the way');
    expect(deliveryProgressLabel('DELIVERED')).toBe('Step 4 of 4 · Delivered');
  });

  it('is null when the delivery is not in a driver step', () => {
    expect(deliveryProgressLabel('CREATED')).toBeNull();
    expect(deliveryProgressLabel('CANCELLED')).toBeNull();
  });
});
