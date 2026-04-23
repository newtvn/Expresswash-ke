import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ORDER_STAGES } from '@/config/constants';
import { getOrderStatusHistory } from '@/services/orderHistoryService';
import type { OrderStatusHistoryEntry } from '@/services/orderHistoryService';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const statusColors: Record<number, string> = {
  1: 'bg-gray-400',
  2: 'bg-blue-400',
  3: 'bg-blue-500',
  4: 'bg-indigo-400',
  5: 'bg-indigo-500',
  6: 'bg-cyan-500',
  7: 'bg-teal-500',
  8: 'bg-amber-500',
  9: 'bg-emerald-400',
  10: 'bg-emerald-500',
  11: 'bg-orange-500',
  12: 'bg-green-600',
  13: 'bg-red-500',
  14: 'bg-red-400',
};

function getStatusLabel(statusId: number): string {
  const stage = ORDER_STAGES.find((s) => s.id === statusId);
  if (stage) return stage.name;
  if (statusId === 13) return 'Cancelled';
  if (statusId === 14) return 'Refunded';
  return `Status ${statusId}`;
}

interface OrderTimelineProps {
  orderId: string;
}

export const OrderTimeline = ({ orderId }: OrderTimelineProps) => {
  const { data: history, isLoading } = useQuery({
    queryKey: ['orders', 'timeline', orderId],
    queryFn: () => getOrderStatusHistory(orderId),
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-3 h-3 rounded-full shrink-0 mt-1" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No status history available
      </p>
    );
  }

  return (
    <div className="relative ml-2 space-y-0">
      {/* Vertical line */}
      {history.length > 1 && (
        <div className="absolute left-[5px] top-3 bottom-3 w-0.5 bg-border" />
      )}

      {history.map((entry: OrderStatusHistoryEntry, i: number) => {
        const dotColor = statusColors[entry.toStatus] ?? 'bg-gray-400';
        const isLast = i === history.length - 1;

        return (
          <div key={entry.id} className={cn('relative flex items-start gap-4 pb-6', isLast && 'pb-0')}>
            {/* Dot */}
            <div
              className={cn(
                'relative top-0.5 w-3 h-3 rounded-full border-2 border-background shrink-0 z-10',
                dotColor,
              )}
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground leading-tight">
                {getStatusLabel(entry.toStatus)}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                <span>{format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}</span>
                <span>by {entry.changedByName}</span>
              </div>
              {entry.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">{entry.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
