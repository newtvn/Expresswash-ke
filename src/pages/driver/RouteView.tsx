import { PageHeader, StatusBadge } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Navigation,
  Clock,
  User,
  Package,
  Route,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  order: number;
  type: 'pickup' | 'delivery';
  orderNumber: string;
  customerName: string;
  address: string;
  zone: string;
  timeSlot: string;
  items: string;
  status: 'completed' | 'in_progress' | 'pending';
}

const mockStops: Stop[] = [
  {
    id: '1', order: 1, type: 'pickup', orderNumber: 'EW-2025-00415',
    customerName: 'Ann Chebet', address: '22 Kenyatta Avenue, Kitengela',
    zone: 'Kitengela', timeSlot: '8:00 AM - 9:00 AM', items: '2 Carpets',
    status: 'completed',
  },
  {
    id: '2', order: 2, type: 'delivery', orderNumber: 'EW-2025-00380',
    customerName: 'Grace Wanjiku', address: '45 Namanga Road, Kitengela',
    zone: 'Kitengela', timeSlot: '9:30 AM - 10:30 AM', items: '1 Mattress, 2 Pillows',
    status: 'completed',
  },
  {
    id: '3', order: 3, type: 'pickup', orderNumber: 'EW-2025-00420',
    customerName: 'David Maina', address: '8 River View Estate, Athi River',
    zone: 'Athi River', timeSlot: '11:00 AM - 12:00 PM', items: '1 Sofa (3-Seater)',
    status: 'in_progress',
  },
  {
    id: '4', order: 4, type: 'delivery', orderNumber: 'EW-2025-00365',
    customerName: 'Peter Kamau', address: '15 Industrial Road, Athi River',
    zone: 'Athi River', timeSlot: '1:00 PM - 2:00 PM', items: '4 Dining Chairs',
    status: 'pending',
  },
  {
    id: '5', order: 5, type: 'pickup', orderNumber: 'EW-2025-00425',
    customerName: 'Faith Akinyi', address: '30 Mombasa Road, Syokimau',
    zone: 'Syokimau', timeSlot: '2:30 PM - 3:30 PM', items: '3 Curtain Pairs, 1 Rug',
    status: 'pending',
  },
  {
    id: '6', order: 6, type: 'delivery', orderNumber: 'EW-2025-00350',
    customerName: 'James Mwangi', address: '5 Uhuru Gardens, Nairobi',
    zone: 'Nairobi', timeSlot: '4:00 PM - 5:00 PM', items: '1 Persian Rug',
    status: 'pending',
  },
];

export const RouteView = () => {
  const completedStops = mockStops.filter((s) => s.status === 'completed').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today's Route"
        description={`${completedStops} of ${mockStops.length} stops completed`}
      >
        <Button variant="outline">
          <Route className="mr-2 h-4 w-4" />
          Optimize Route
        </Button>
      </PageHeader>

      {/* Route Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Route Progress</span>
            <span className="font-medium">{Math.round((completedStops / mockStops.length) * 100)}%</span>
          </div>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(completedStops / mockStops.length) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stops List */}
      <div className="space-y-4">
        {mockStops.map((stop, index) => {
          const isActive = stop.status === 'in_progress';
          return (
            <div key={stop.id} className="flex gap-4">
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    stop.status === 'completed' && 'bg-primary text-primary-foreground',
                    stop.status === 'in_progress' && 'bg-primary/20 text-primary border-2 border-primary',
                    stop.status === 'pending' && 'bg-muted text-muted-foreground'
                  )}
                >
                  {stop.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    stop.order
                  )}
                </div>
                {index < mockStops.length - 1 && (
                  <div className={cn('w-0.5 flex-1 my-1', stop.status === 'completed' ? 'bg-primary' : 'bg-muted')} />
                )}
              </div>

              {/* Stop Card */}
              <Card className={cn('flex-1 mb-2', isActive && 'border-primary/30 bg-primary/5')}>
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={stop.type === 'pickup' ? 'default' : 'secondary'}>
                          {stop.type === 'pickup' ? 'Pickup' : 'Delivery'}
                        </Badge>
                        <span className="text-sm font-medium">#{stop.orderNumber}</span>
                        {isActive && <Badge className="bg-orange-500 text-white border-0">In Progress</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{stop.customerName}</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span>{stop.address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{stop.items}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{stop.timeSlot}</span>
                      </div>
                      {stop.status !== 'completed' && (
                        <Button size="sm" variant={isActive ? 'default' : 'outline'}>
                          <Navigation className="mr-1 h-3 w-3" />
                          Navigate
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RouteView;
