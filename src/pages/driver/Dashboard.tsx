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
import { Truck, Wallet, Star, Clock, MapPin, Phone, User, Navigation, Package, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { getDriverRoutes, updateDriverStatus, getDriverPerformance } from '@/services/driverService';
import { toast } from 'sonner';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isOnline, setIsOnline] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ['driver', 'routes', user?.id, today],
    queryFn: () => getDriverRoutes(user!.id, today),
    enabled: !!user?.id,
  });

  const { data: performance } = useQuery({
    queryKey: ['driver', 'performance', user?.id],
    queryFn: () => getDriverPerformance(user!.id),
    enabled: !!user?.id,
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

  const activeRoute = routes.find((r) => r.status === 'in_progress');
  const allStops = routes.flatMap((r) => r.stops);
  const pendingStops = allStops.filter((s) => s.status === 'pending');
  const activeStop = pendingStops[0];

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
        <KPICard label="Deliveries Today" value={allStops.filter((s) => s.status === 'completed').length} icon={Truck} />
        <KPICard label="Avg Rating" value={performance?.avgRating ?? 0} icon={Star} />
        <KPICard label="On-Time %" value={performance?.onTimeRate ?? 0} format="percentage" icon={Clock} />
        <KPICard label="Total Deliveries" value={performance?.totalDeliveries ?? 0} icon={Package} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {routesLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : activeStop ? (
            <Card className="border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Active Task</CardTitle>
                <Badge variant={activeStop.type === 'pickup' ? 'default' : 'secondary'} className="capitalize">{activeStop.type}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">#{activeStop.orderId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{activeStop.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{activeStop.scheduledTime}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span>{activeStop.address}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={() => navigate(ROUTES.DRIVER_PICKUP_DELIVERY)}>
                    <Navigation className="mr-2 h-4 w-4" /> Navigate
                  </Button>
                  <Button variant="outline" onClick={() => navigate(ROUTES.DRIVER_PICKUP_DELIVERY)}>
                    View Details <ArrowRight className="ml-2 h-4 w-4" />
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

      {/* Upcoming Stops */}
      {pendingStops.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Today's Schedule ({pendingStops.length} pending)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingStops.map((stop) => (
                <div key={stop.id ?? stop.orderId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant={stop.type === 'pickup' ? 'default' : 'secondary'} className="capitalize">{stop.type}</Badge>
                    <div>
                      <p className="text-sm font-medium">{stop.customerName}</p>
                      <p className="text-xs text-muted-foreground">#{stop.orderId} — {stop.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{stop.scheduledTime}</span>
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
