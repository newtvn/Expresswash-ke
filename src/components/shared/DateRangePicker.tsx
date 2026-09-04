import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type DateValue = { from: Date | undefined; to: Date | undefined };

type DateRangePickerProps =
  | {
      startDate: string;
      endDate: string;
      onRangeChange: (start: string, end: string) => void;
      className?: string;
    }
  | {
      date: DateValue;
      onDateChange: (date: DateValue) => void;
      className?: string;
    };

const toInputDate = (date?: Date) => date ? date.toISOString().split('T')[0] : '';
const detectPreset = (start: string, end: string): number | null => {
  if (!start || !end) return null;
  const days = Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86_400_000);
  return [7, 30, 90].includes(days) ? days : null;
};

export const DateRangePicker = (props: DateRangePickerProps) => {
  const fromId = useId();
  const toId = useId();
  const controlledStart = 'startDate' in props ? props.startDate : toInputDate(props.date.from);
  const controlledEnd = 'endDate' in props ? props.endDate : toInputDate(props.date.to);
  const [start, setStart] = useState(controlledStart);
  const [end, setEnd] = useState(controlledEnd);
  const [activePreset, setActivePreset] = useState<number | null>(() => detectPreset(controlledStart, controlledEnd));

  useEffect(() => {
    setStart(controlledStart);
    setEnd(controlledEnd);
    setActivePreset(detectPreset(controlledStart, controlledEnd));
  }, [controlledStart, controlledEnd]);

  const publish = (nextStart: string, nextEnd: string) => {
    if ('onRangeChange' in props) {
      props.onRangeChange(nextStart, nextEnd);
      return;
    }
    props.onDateChange({
      from: nextStart ? new Date(`${nextStart}T00:00:00`) : undefined,
      to: nextEnd ? new Date(`${nextEnd}T23:59:59`) : undefined,
    });
  };

  const handleApply = () => {
    setActivePreset(null);
    publish(start, end);
  };

  const setPreset = (days: number) => {
    const presetEnd = new Date();
    const presetStart = new Date();
    presetStart.setDate(presetStart.getDate() - days);
    const nextStart = toInputDate(presetStart);
    const nextEnd = toInputDate(presetEnd);
    setStart(nextStart);
    setEnd(nextEnd);
    setActivePreset(days);
    publish(nextStart, nextEnd);
  };

  return (
    <div className={props.className}>
      <div className="grid grid-cols-1 items-end gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap" aria-label="Date range">
        <div className="min-w-0 space-y-1">
          <Label htmlFor={fromId} className="text-xs text-muted-foreground">From</Label>
          <Input
            id={fromId}
            aria-label="Start date"
            type="date"
            value={start}
            onChange={(event) => { setStart(event.target.value); setActivePreset(null); }}
            className="h-9 w-full sm:w-40"
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor={toId} className="text-xs text-muted-foreground">To</Label>
          <Input
            id={toId}
            aria-label="End date"
            type="date"
            value={end}
            onChange={(event) => { setEnd(event.target.value); setActivePreset(null); }}
            className="h-9 w-full sm:w-40"
          />
        </div>
        <Button size="sm" variant="default" className="w-full sm:w-auto" onClick={handleApply} disabled={!start && !end}>
          Apply
        </Button>
        <div className="grid grid-cols-3 gap-1 sm:flex" aria-label="Quick date ranges">
          {[7, 30, 90].map((days) => (
            <Button
              key={days}
              size="sm"
              variant={activePreset === days ? 'secondary' : 'ghost'}
              aria-pressed={activePreset === days}
              onClick={() => setPreset(days)}
            >
              {days}D
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
