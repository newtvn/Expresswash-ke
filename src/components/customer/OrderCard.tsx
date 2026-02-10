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
}

const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  picked_up: 'secondary',
  processing: 'secondary',
  ready: 'default',
  delivered: 'default',
  cancelled: 'destructive',
};

const statusLabelMap: Record<string, string> = {
  pending: 'Pending',
  picked_up: 'Picked Up',
  processing: 'Processing',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function OrderCard({
  orderNumber,
  status,
  itemsCount,
  date,
  zone,
  className,
}: OrderCardProps) {
  return (
    <Card className={cn('transition-shadow hover:shadow-md', className)}>
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
