import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, KPICard, StatusBadge } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ROUTES } from '@/config/routes';
import {
  Truck,
  Wallet,
  Star,
  Clock,
  MapPin,
  Phone,
  User,
  Navigation,
  Package,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const activeTask = {
  type: 'delivery' as const,
  orderNumber: 'EW-2025-00380',
  customerName: 'Grace Wanjiku',
  phone: '+254 712 345 678',
  address: '45 Namanga Road, Kitengela',
  zone: 'Kitengela',
  items: '1 Mattress, 2 Pillows',
  status: 'out_for_delivery',
};

const upcomingAssignments = [
  { id: '1', orderNumber: 'EW-2025-00395', type: 'pickup', customerName: 'Peter Kamau', zone: 'Athi River', timeSlot: '2:00 PM - 3:00 PM', items: '3 Curtain Pairs' },
  { id: '2', orderNumber: 'EW-2025-00398', type: 'delivery', customerName: 'Mary Njeri', zone: 'Kitengela', timeSlot: '3:30 PM - 4:30 PM', items: '1 Carpet (Large)' },
  { id: '3', orderNumber: 'EW-2025-00401', type: 'pickup', customerName: 'John Odera', zone: 'Nairobi', timeSlot: '5:00 PM - 6:00 PM', items: '2 Rugs, 1 Sofa Cover' },
  { id: '4', orderNumber: 'EW-2025-00405', type: 'delivery', customerName: 'Sarah Wambui', zone: 'Syokimau', timeSlot: '6:00 PM - 7:00 PM', items: '4 Dining Chairs' },
];

export const Dashboard = () => {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(true);

  return (
    <div className="space-y-6">
      <PageHeader title="Driver Dashboard" description="Today's overview and assignments">
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-medium', isOnline ? 'text-green-600' : 'text-muted-foreground')}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <Switch checked={isOnline} onCheckedChange={setIsOnline} />
        </div>
      </PageHeader>

      {/* Today's Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Deliveries Today"
          value={7}
          change={12}
          changeDirection="up"
          icon={Truck}
        />
        <KPICard
          label="Earnings Today"
          value={3200}
          change={8}
          changeDirection="up"
          format="currency"
          icon={Wallet}
        />
        <KPICard
          label="Avg Rating"
          value={4.8}
          change={2}
          changeDirection="up"
          icon={Star}
        />
        <KPICard
          label="On-Time %"
          value={96}
          change={3}
          changeDirection="up"
          format="percentage"
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Task */}
        <div className="lg:col-span-2">
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Active Task</CardTitle>
              <StatusBadge status={activeTask.status} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">#{activeTask.orderNumber}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{activeTask.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{activeTask.phone}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span>{activeTask.address}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Items: </span>
                    <span>{activeTask.items}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={() => navigate(ROUTES.DRIVER_PICKUP_DELIVERY)}>
                  <Navigation className="mr-2 h-4 w-4" />
                  Navigate
                </Button>
                <Button variant="outline" onClick={() => navigate(ROUTES.DRIVER_PICKUP_DELIVERY)}>
                  View Details
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Map view placeholder</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={assignment.type === 'pickup' ? 'default' : 'secondary'}>
                    {assignment.type === 'pickup' ? 'Pickup' : 'Delivery'}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{assignment.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      #{assignment.orderNumber} - {assignment.items}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{assignment.zone}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{assignment.timeSlot}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
