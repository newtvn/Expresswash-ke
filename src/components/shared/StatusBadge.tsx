import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  // Order statuses
  pending_quote: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  quote_sent: 'bg-blue-100 text-blue-800 border-blue-200',
  quote_accepted: 'bg-green-100 text-green-800 border-green-200',
  pickup_scheduled: 'bg-purple-100 text-purple-800 border-purple-200',
  picked_up: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  in_washing: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  drying: 'bg-sky-100 text-sky-800 border-sky-200',
  quality_check: 'bg-orange-100 text-orange-800 border-orange-200',
  ready_for_dispatch: 'bg-teal-100 text-teal-800 border-teal-200',
  dispatched: 'bg-violet-100 text-violet-800 border-violet-200',
  out_for_delivery: 'bg-amber-100 text-amber-800 border-amber-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',

  // Invoice statuses
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  sent: 'bg-blue-100 text-blue-800 border-blue-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  partially_paid: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  overdue: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  refunded: 'bg-orange-100 text-orange-800 border-orange-200',
  unpaid: 'bg-red-100 text-red-800 border-red-200',

  // General
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  suspended: 'bg-red-100 text-red-800 border-red-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  failed: 'bg-red-100 text-red-800 border-red-200',

  // Log levels
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  warn: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  debug: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const style = STATUS_STYLES[status.toLowerCase()] || STATUS_STYLES['pending'];
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Badge variant="outline" className={cn('font-medium text-xs', style, className)}>
      {label}
    </Badge>
  );
};
