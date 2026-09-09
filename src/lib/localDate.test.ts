import { describe, expect, it } from 'vitest';
import { toLocalDateString } from './localDate';

describe('toLocalDateString', () => {
  it('uses local calendar fields instead of converting through UTC', () => {
    const nearMidnight = new Date(2026, 8, 9, 0, 30);

    expect(toLocalDateString(nearMidnight)).toBe('2026-09-09');
  });

  it('zero-pads months and days', () => {
    expect(toLocalDateString(new Date(2026, 0, 2))).toBe('2026-01-02');
  });

  it('preserves undefined for optional date-range values', () => {
    expect(toLocalDateString()).toBeUndefined();
  });
});
