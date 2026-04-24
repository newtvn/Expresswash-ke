import { Package, Calendar, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  orderNumber: string;
  status: string;
  itemsCount: number;
  date: string;
  zone: string;
  className?: string;
  onClick?: () => void;
}

const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending_quote: 'outline',
  quote_sent: 'secondary',
  quote_accepted: 'secondary',
  pickup_scheduled: 'secondary',
  picked_up: 'secondary',
  in_washing: 'default',
  drying: 'default',
  quality_check: 'default',
  ready_for_dispatch: 'default',
  dispatched: 'default',
  out_for_delivery: 'default',
  delivered: 'default',
  cancelled: 'destructive',
  refunded: 'destructive',
};

const statusLabelMap: Record<string, string> = {
  pending_quote: 'Pending Quote',
  quote_sent: 'Quote Sent',
  quote_accepted: 'Quote Accepted',
  pickup_scheduled: 'Pickup Scheduled',
  picked_up: 'Picked Up',
  in_washing: 'In Washing',
  drying: 'Drying',
  quality_check: 'Quality Check',
  ready_for_dispatch: 'Ready for Dispatch',
  dispatched: 'Dispatched',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export function OrderCard({
  orderNumber,
  status,
  itemsCount,
  date,
  zone,
  className,
  onClick,
}: OrderCardProps) {
  return (
    <Card className={cn('transition-shadow hover:shadow-md', onClick && 'cursor-pointer hover:border-primary/30', className)} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">#{orderNumber}</CardTitle>
        <Badge variant={statusVariantMap[status] ?? 'outline'}>
          {statusLabelMap[status] ?? status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>{itemsCount} {itemsCount === 1 ? 'item' : 'items'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{date}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>{zone}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
