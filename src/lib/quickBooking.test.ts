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
      propertyType: 'home',
      rooms: '3',
      pickupDate,
    });

    expect(parseQuickBookingSearch(search)).toEqual({
      service: 'carpet',
      serviceLabel: 'Carpet Cleaning',
      zone: 'Kitengela',
      propertyType: 'home',
      propertyTypeLabel: 'House',
      rooms: '3',
      roomsLabel: '3 rooms',
      pickupDate,
    });
  });

  it('drops unsupported values and past dates', () => {
    const parsed = parseQuickBookingSearch(
      'service=unknown&propertyType=castle&rooms=99&pickupDate=2020-01-01',
    );

    expect(parsed.service).toBe('');
    expect(parsed.propertyType).toBe('');
    expect(parsed.rooms).toBe('');
    expect(parsed.pickupDate).toBe('');
  });
});

