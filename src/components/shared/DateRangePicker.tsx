import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  className?: string;
}

export const DateRangePicker = ({
  startDate,
  endDate,
  onRangeChange,
  className,
}: DateRangePickerProps) => {
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);

  const handleApply = () => {
    onRangeChange(start, end);
  };

  const setPreset = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const s = startDate.toISOString().split('T')[0];
    const e = endDate.toISOString().split('T')[0];
    setStart(s);
    setEnd(e);
    onRangeChange(s, e);
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-40 h-9"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-40 h-9"
          />
          <Button size="sm" variant="default" onClick={handleApply}>
            Apply
          </Button>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setPreset(7)}>
            7D
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPreset(30)}>
            30D
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPreset(90)}>
            90D
          </Button>
        </div>
      </div>
    </div>
  );
};
