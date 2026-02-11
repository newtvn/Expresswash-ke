import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Clock, CheckCircle, Package, Navigation, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getDriverRoutes, completeRouteStop } from '@/services/driverService';
import { updateOrderStatus } from '@/services/orderService';

export const PickupDelivery = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['driver', 'routes', user?.id, today],
    queryFn: () => getDriverRoutes(user!.id, today),
    enabled: !!user?.id,
  });

  const completeMutation = useMutation({
    mutationFn: async ({ stopId, orderId, type }: { stopId: string; orderId: string; type: 'pickup' | 'delivery' }) => {
      await completeRouteStop(stopId);
      // Advance order status: pickup -> 5 (Picked Up), delivery -> 12 (Delivered)
      await updateOrderStatus(orderId, type === 'pickup' ? 5 : 12);
    },
    onSuccess: () => {
      toast.success('Stop completed and order updated!');
      qc.invalidateQueries({ queryKey: ['driver', 'routes', user?.id] });
    },
    onError: () => toast.error('Failed to complete stop'),
  });

  const allStops = routes.flatMap((r) =>
    r.stops.map((s) => ({ ...s, routeId: r.id, routeDate: r.date }))
  );

  const pickupStops = allStops.filter((s) => s.type === 'pickup');
  const deliveryStops = allStops.filter((s) => s.type === 'delivery');

  const StopCard = ({ stop }: { stop: typeof allStops[0] }) => (
    <Card className={stop.status === 'completed' ? 'opacity-60' : ''}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">#{stop.orderId}</span>
              <Badge variant={stop.status === 'completed' ? 'secondary' : 'default'} className="text-xs capitalize">{stop.status}</Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{stop.address}</div>
              <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{stop.scheduledTime}</div>
              <div className="flex items-center gap-1"><Package className="h-3 w-3" />{stop.customerName}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {stop.status === 'pending' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(stop.address)}`)}
                >
                  <Navigation className="h-3 w-3 mr-1" /> Navigate
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    completeMutation.mutate({
                      stopId: stop.id ?? stop.orderId,
                      orderId: stop.orderId,
                      type: stop.type,
                    })
                  }
                  disabled={completeMutation.isPending}
                >
                  <CheckCircle className="h-3 w-3 mr-1" /> Complete
                </Button>
              </>
            )}
            {stop.status === 'completed' && (
              <Badge className="bg-green-100 text-green-800 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> Done
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Pickups & Deliveries" description="Manage today's assignments" />

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : (
        <Tabs defaultValue="pickups">
          <TabsList>
            <TabsTrigger value="pickups">Pickups ({pickupStops.filter((s) => s.status === 'pending').length} pending)</TabsTrigger>
            <TabsTrigger value="deliveries">Deliveries ({deliveryStops.filter((s) => s.status === 'pending').length} pending)</TabsTrigger>
          </TabsList>
          <TabsContent value="pickups" className="mt-4 space-y-3">
            {pickupStops.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pickups scheduled today</p>
            ) : pickupStops.map((s, i) => <StopCard key={s.id ?? i} stop={s} />)}
          </TabsContent>
          <TabsContent value="deliveries" className="mt-4 space-y-3">
            {deliveryStops.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No deliveries scheduled today</p>
            ) : deliveryStops.map((s, i) => <StopCard key={s.id ?? i} stop={s} />)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default PickupDelivery;
