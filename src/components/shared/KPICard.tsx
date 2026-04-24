import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: string | number;
  change?: number;
  changeDirection?: 'up' | 'down' | 'flat';
  format?: 'number' | 'currency' | 'percentage';
  icon?: LucideIcon;
  className?: string;
  onClick?: () => void;
}

export const KPICard = ({
  label,
  value,
  change,
  changeDirection,
  format = 'number',
  icon: Icon,
  className,
  onClick,
}: KPICardProps) => {
  const formatValue = () => {
    switch (format) {
      case 'currency':
        return `KES ${Number(value).toLocaleString()}`;
      case 'percentage':
        return `${value}%`;
      default:
        return typeof value === 'number' ? value.toLocaleString() : String(value);
    }
  };

  const showChange = change != null && !isNaN(change) && changeDirection != null;

  const TrendIcon =
    changeDirection === 'up'
      ? TrendingUp
      : changeDirection === 'down'
      ? TrendingDown
      : Minus;

  return (
    <Card
      className={cn(
        'bg-card border-border/50 hover:shadow-md transition-shadow',
        onClick && 'cursor-pointer hover:border-primary/30',
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{formatValue()}</p>
          </div>
          {Icon && (
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
        </div>
        {showChange && (
          <div
            className={cn('flex items-center gap-1 mt-3 text-sm', {
              'text-green-600': changeDirection === 'up',
              'text-red-500': changeDirection === 'down',
              'text-muted-foreground': changeDirection === 'flat',
            })}
          >
            <TrendIcon className="w-4 h-4" />
            <span>{Math.abs(change)}% vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
