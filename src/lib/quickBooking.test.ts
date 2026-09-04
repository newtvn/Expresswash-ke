import { describe, expect, it } from 'vitest';
import {
  buildQuickBookingSearch,
  getLocalDateString,
  parseQuickBookingSearch,
} from '@/lib/quickBooking';

describe('quick booking URL handoff', () => {
  it('round-trips a valid booking selection', () => {
    const pickupDate = getLocalDateString(new Date(Date.now() + 86_400_000));
    const search = buildQuickBookingSearch({
      service: 'carpet',
      zone: 'Kitengela',
      pickupDate,
    });

    expect(parseQuickBookingSearch(search)).toEqual({
      service: 'carpet',
      serviceLabel: 'Carpet Cleaning',
      zone: 'Kitengela',
      pickupDate,
    });
  });

  it('drops unsupported values and past dates', () => {
    const parsed = parseQuickBookingSearch(
      'service=unknown&pickupDate=2020-01-01',
    );

    expect(parsed.service).toBe('');
    expect(parsed.pickupDate).toBe('');
  });
});
