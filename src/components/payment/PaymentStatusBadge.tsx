/**
 * Payment Status Badge Component
 * Displays payment status with appropriate styling
 */

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, AlertCircle, RotateCcw, Ban } from 'lucide-react';
import type { PaymentStatus } from '@/types/payment';

interface PaymentStatusBadgeProps {
  status: PaymentStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const statusConfig: Record<
  PaymentStatus | 'paid' | 'unpaid',
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className: string;
  }
> = {
  completed: {
    label: 'Paid',
    icon: CheckCircle2,
    variant: 'default',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  paid: {
    label: 'Paid',
    icon: CheckCircle2,
    variant: 'default',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  processing: {
    label: 'Processing',
    icon: Clock,
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  cancelled: {
    label: 'Cancelled',
    icon: Ban,
    variant: 'outline',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  refunded: {
    label: 'Refunded',
    icon: RotateCcw,
    variant: 'outline',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  unpaid: {
    label: 'Unpaid',
    icon: AlertCircle,
    variant: 'outline',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
};

export function PaymentStatusBadge({
  status,
  size = 'md',
  showIcon = true,
}: PaymentStatusBadgeProps) {
  const config = statusConfig[status as PaymentStatus] || statusConfig.pending;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} ${sizeClasses[size]} inline-flex items-center gap-1.5 border`}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{config.label}</span>
    </Badge>
  );
}
