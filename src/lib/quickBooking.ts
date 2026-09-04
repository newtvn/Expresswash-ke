export const QUICK_BOOKING_SERVICES = [
  { value: 'carpet', label: 'Carpet Cleaning' },
  { value: 'rug', label: 'Rug Cleaning' },
  { value: 'sofa', label: 'Sofa & Upholstery' },
  { value: 'curtain', label: 'Curtain Cleaning' },
  { value: 'mattress', label: 'Mattress Cleaning' },
] as const;

export const QUICK_BOOKING_PROPERTY_TYPES = [
  { value: 'home', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'office', label: 'Office' },
  { value: 'commercial', label: 'Commercial Space' },
] as const;

export const QUICK_BOOKING_ROOM_OPTIONS = [
  { value: '1', label: '1 room' },
  { value: '2', label: '2 rooms' },
  { value: '3', label: '3 rooms' },
  { value: '4', label: '4 rooms' },
  { value: '5+', label: '5+ rooms' },
] as const;

export interface QuickBookingSelection {
  service: string;
  zone: string;
  propertyType: string;
  rooms: string;
  pickupDate: string;
}

const findLabel = (
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) => options.find((option) => option.value === value)?.label;

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const buildQuickBookingSearch = (selection: QuickBookingSelection) => {
  const params = new URLSearchParams({
    service: selection.service,
    zone: selection.zone,
    propertyType: selection.propertyType,
    rooms: selection.rooms,
    pickupDate: selection.pickupDate,
  });

  return params.toString();
};

export const parseQuickBookingSearch = (search: string) => {
  const params = new URLSearchParams(search);
  const service = params.get('service') ?? '';
  const propertyType = params.get('propertyType') ?? '';
  const rooms = params.get('rooms') ?? '';
  const pickupDate = params.get('pickupDate') ?? '';

  return {
    service: findLabel(QUICK_BOOKING_SERVICES, service) ? service : '',
    serviceLabel: findLabel(QUICK_BOOKING_SERVICES, service) ?? '',
    zone: (params.get('zone') ?? '').slice(0, 100),
    propertyType: findLabel(QUICK_BOOKING_PROPERTY_TYPES, propertyType)
      ? propertyType
      : '',
    propertyTypeLabel:
      findLabel(QUICK_BOOKING_PROPERTY_TYPES, propertyType) ?? '',
    rooms: findLabel(QUICK_BOOKING_ROOM_OPTIONS, rooms) ? rooms : '',
    roomsLabel: findLabel(QUICK_BOOKING_ROOM_OPTIONS, rooms) ?? '',
    pickupDate:
      isIsoDate(pickupDate) && pickupDate >= getLocalDateString()
        ? pickupDate
        : '',
  };
};

