import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, KPICard, StatusBadge } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/config/routes';
import { Truck, Star, Clock, MapPin, User, Navigation, Package, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { getDriverById, updateDriverStatus, getDriverPerformance } from '@/services/driverService';
import { getDriverAssignedOrders } from '@/services/orderService';
import { getOrderStatusLabel } from '@/constants/orderStatus';
import { toast } from 'sonner';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isOnline, setIsOnline] = useState(false);

  const { data: assignedOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['driver', 'assigned-orders', user?.id],
    queryFn: () => getDriverAssignedOrders(user!.id),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const { data: performance } = useQuery({
    queryKey: ['driver', 'performance', user?.id],
    queryFn: () => getDriverPerformance(user!.id),
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const statusMutation = useMutation({
    mutationFn: (online: boolean) =>
      updateDriverStatus(user!.id, online ? 'available' : 'offline'),
    onSuccess: (_, online) => {
      toast.success(online ? 'You are now online' : 'You are now offline');
      qc.invalidateQueries({ queryKey: ['driver'] });
    },
  });

  const handleToggleOnline = (checked: boolean) => {
    setIsOnline(checked);
    statusMutation.mutate(checked);
  };

  // Auto-set driver online when they log in
  useEffect(() => {
    if (!user?.id) return;
    getDriverById(user.id).then((driver) => {
      const alreadyOnline = driver?.isOnline ?? false;
      setIsOnline(true);
      if (!alreadyOnline) {
        updateDriverStatus(user.id, 'available');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const activeOrder = assignedOrders[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Driver Dashboard" description="Today's overview and assignments">
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-medium', isOnline ? 'text-green-600' : 'text-muted-foreground')}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <Switch checked={isOnline} onCheckedChange={handleToggleOnline} disabled={statusMutation.isPending} />
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Deliveries Today" value={assignedOrders.filter((o) => o.status === 'delivered').length} icon={Truck} onClick={() => navigate(ROUTES.DRIVER_PICKUP_DELIVERY)} />
        <KPICard label="Avg Rating" value={performance?.avgRating ?? 0} icon={Star} onClick={() => navigate(ROUTES.DRIVER_PICKUP_DELIVERY)} />
        <KPICard label="On-Time %" value={performance?.onTimeRate ?? 0} format="percentage" icon={Clock} onClick={() => navigate(ROUTES.DRIVER_ROUTE)} />
        <KPICard label="Total Deliveries" value={performance?.totalDeliveries ?? 0} icon={Package} onClick={() => navigate(ROUTES.DRIVER_PICKUP_DELIVERY)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {ordersLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : activeOrder ? (
            <Card className="border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Active Assignment</CardTitle>
                <Badge variant="default" className="capitalize">Pickup</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">#{activeOrder.trackingCode}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{activeOrder.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{activeOrder.pickupDate ?? 'TBD'}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span>{activeOrder.pickupAddress ?? activeOrder.zone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium">{getOrderStatusLabel(activeOrder.status)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={() => navigate(ROUTES.DRIVER_PICKUP_DELIVERY)}>
                    <Navigation className="mr-2 h-4 w-4" /> Navigate
                  </Button>
                  <Button variant="outline" onClick={() => navigate(ROUTES.DRIVER_PICKUP_DELIVERY)}>
                    View All Orders <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Truck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-base font-medium">No active tasks</p>
                <p className="text-sm mt-1">{isOnline ? "You're online and ready for assignments" : 'Go online to receive assignments'}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Map Integration */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Live Map</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48 bg-muted rounded-lg overflow-hidden relative">
              {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
                <iframe
                  title="Driver Location Map"
                  className="w-full h-full border-0"
                  loading="lazy"
                  src={`https://www.google.com/maps/embed/v1/view?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&center=-1.4753,36.9921&zoom=12`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MapPin className="h-8 w-8 mb-2" />
                  <p className="text-sm">Add VITE_GOOGLE_MAPS_API_KEY</p>
                  <p className="text-xs mt-1">to enable live map</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Assigned Orders */}
      {assignedOrders.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">All Assignments ({assignedOrders.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignedOrders.map((order) => (
                <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="capitalize shrink-0">Pickup</Badge>
                    <div>
                      <p className="text-sm font-medium">{order.customerName}</p>
                      <p className="text-xs text-muted-foreground">#{order.trackingCode} — {order.pickupAddress ?? order.zone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="text-xs font-medium">{getOrderStatusLabel(order.status)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
