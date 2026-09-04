import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AnimatedButton } from '@/components/ui/animated-button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ROUTES } from '@/config/routes';
import { useActiveZones } from '@/hooks/useZones';
import {
  buildQuickBookingSearch,
  getLocalDateString,
  QUICK_BOOKING_SERVICES,
  type QuickBookingSelection,
} from '@/lib/quickBooking';

const initialSelection = (): QuickBookingSelection => ({
  service: 'carpet',
  zone: '',
  propertyType: '',
  rooms: '',
  pickupDate: '',
});

// Build a local Date from a `yyyy-MM-dd` string without tripping over UTC parsing.
const toDate = (iso: string) => {
  if (!iso) return undefined;
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

interface BookingFieldProps {
  label: string;
  children: React.ReactNode;
}

const BookingField = ({ label, children }: BookingFieldProps) => (
  <div className="flex min-w-0 flex-col justify-center border-b border-slate-100 px-5 py-3 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
    <span className="block text-[13px] font-medium text-slate-400">{label}</span>
    <div className="relative">{children}</div>
  </div>
);

const controlClassName =
  'mt-0.5 w-full cursor-pointer appearance-none bg-transparent pr-6 text-[15px] font-semibold outline-none focus:outline-none focus-visible:outline-none disabled:cursor-wait disabled:text-slate-400';

const FieldChevron = () => (
  <ChevronDown
    className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
    aria-hidden="true"
  />
);

// Hand-drawn arrow nudging the eye from the "Book in 60 Seconds" label to the first field.
const CurvedArrow = () => (
  <svg
    viewBox="0 0 44 40"
    className="ml-1 hidden h-8 w-8 shrink-0 text-primary lg:block"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4 8c14-4 24 1 27 14"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M24 20l7.5 3 1.5-8"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const HeroQuickBooking = () => {
  const navigate = useNavigate();
  const { data: activeZones = [], isLoading: zonesLoading } = useActiveZones();
  const [selection, setSelection] = useState(initialSelection);
  const [isVisible, setIsVisible] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const updateSelection = (field: keyof QuickBookingSelection, value: string) => {
    setSelection((current) => ({ ...current, [field]: value }));
  };

  // Keep the catch-all "Other" area at the bottom of the list, whatever the source order.
  const sortedZones = [...activeZones].sort((a, b) => {
    const aOther = a.name.trim().toLowerCase() === 'other';
    const bOther = b.name.trim().toLowerCase() === 'other';
    if (aOther !== bOther) return aOther ? 1 : -1;
    return 0;
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const submittedSelection: QuickBookingSelection = {
      service: String(formData.get('service') ?? ''),
      zone: String(formData.get('zone') ?? ''),
      propertyType: '',
      rooms: '',
      pickupDate: String(formData.get('pickupDate') ?? ''),
    };

    if (!submittedSelection.service || !submittedSelection.zone || !submittedSelection.pickupDate) {
      toast.error('Please choose a service, location, and date to continue.');
      return;
    }

    const search = buildQuickBookingSearch(submittedSelection);
    navigate(`${ROUTES.CUSTOMER_REQUEST_PICKUP}?${search}`);
  };

  const selectedDate = toDate(selection.pickupDate);

  return (
    <div
      className={`container relative z-40 mx-auto max-w-[1380px] px-4 transition-all duration-1000 ease-out motion-reduce:transform-none motion-reduce:transition-none sm:px-6 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
      }`}
    >
      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-3xl border border-white bg-white shadow-[0_24px_60px_-24px_rgba(30,64,175,0.35)]"
        aria-label="Quick booking"
      >
        <div
          className="h-[3px] w-full"
          style={{
            background:
              'linear-gradient(to right, hsl(var(--primary)) 0 33.33%, #F4743B 33.33% 66.66%, hsl(var(--primary)) 66.66% 100%)',
          }}
          aria-hidden="true"
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-[auto_1.2fr_1.2fr_1.2fr_auto] lg:items-stretch">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 md:col-span-2 lg:col-span-1 lg:border-b-0 lg:border-r">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-sm">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-[15px] font-bold leading-tight text-slate-900">
              Book in 60
              <br />
              Seconds
            </p>
            <CurvedArrow />
          </div>

          <BookingField label="Service">
            <select
              name="service"
              value={selection.service}
              onChange={(event) => updateSelection('service', event.target.value)}
              className={`${controlClassName} text-slate-800`}
              aria-label="Service"
              required
            >
              {QUICK_BOOKING_SERVICES.map((service) => (
                <option key={service.value} value={service.value}>
                  {service.label}
                </option>
              ))}
            </select>
            <FieldChevron />
          </BookingField>

          <BookingField label="Location">
            <select
              name="zone"
              value={selection.zone}
              onChange={(event) => updateSelection('zone', event.target.value)}
              className={`${controlClassName} ${selection.zone ? 'text-slate-800' : 'text-slate-400'}`}
              aria-label="Location"
              disabled={zonesLoading}
              required
            >
              <option value="">{zonesLoading ? 'Loading areas…' : 'Select your area'}</option>
              {sortedZones.map((zone) => (
                <option key={zone.id} value={zone.name}>
                  {zone.name}
                </option>
              ))}
            </select>
            <FieldChevron />
          </BookingField>

          <BookingField label="Preferred Date">
            <input type="hidden" name="pickupDate" value={selection.pickupDate} />
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="mt-0.5 flex w-full items-center justify-between gap-2 bg-transparent text-left text-[15px] font-semibold outline-none focus:outline-none focus-visible:outline-none"
                  aria-label="Preferred date"
                >
                  <span className={selectedDate ? 'text-slate-800' : 'font-normal text-slate-400'}>
                    {selectedDate ? format(selectedDate, 'PP') : 'Pick a date'}
                  </span>
                  <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  fixedWeeks
                  selected={selectedDate}
                  defaultMonth={selectedDate ?? today}
                  disabled={(date) => date < today}
                  onSelect={(date) => {
                    updateSelection('pickupDate', date ? getLocalDateString(date) : '');
                    setDateOpen(false);
                  }}
                  initialFocus
                  classNames={{
                    cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-transparent focus-within:relative focus-within:z-20',
                    day_today: 'bg-primary/10 text-primary',
                    day_selected:
                      '!bg-[#F4743B] !text-white hover:!bg-[#F4743B] focus:!bg-[#F4743B]',
                  }}
                />
              </PopoverContent>
            </Popover>
          </BookingField>

          <div className="flex items-center p-3 md:col-span-2 lg:col-span-1">
            <AnimatedButton
              type="submit"
              color="#fff"
              hoverColor="#fff"
              fillColor="#000000"
              bg="#F4743B"
              bordered={false}
              className="w-full px-7 py-4 text-sm lg:w-auto"
            >
              Book Pickup
            </AnimatedButton>
          </div>
        </div>
      </form>
    </div>
  );
};
