import { describe, expect, it } from 'vitest';

import { ratingSummaryLabel, starsText } from './rating';

describe('ratingSummaryLabel', () => {
  it('shows the average with one decimal and the count', () => {
    expect(ratingSummaryLabel({ average: 4.7, count: 12 })).toBe('★ 4.7 · 12 ratings');
    expect(ratingSummaryLabel({ average: 5, count: 1 })).toBe('★ 5.0 · 1 rating');
  });

  it('says so before the first rating', () => {
    expect(ratingSummaryLabel({ average: null, count: 0 })).toBe('No ratings yet');
  });
});

describe('starsText', () => {
  it('draws the score out of five', () => {
    expect(starsText(3)).toBe('★★★☆☆');
    expect(starsText(7)).toBe('★★★★★');
  });
});
