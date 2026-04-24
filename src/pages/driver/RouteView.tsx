import { PageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin,
  Navigation,
  Clock,
  User,
  Package,
  Route,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { getDriverRoutes, type RouteStop } from '@/services/driverService';

export const RouteView = () => {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['driver', 'routes', user?.id, today],
    queryFn: () => getDriverRoutes(user!.id, today),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Flatten all stops from today's routes
  const stops: (RouteStop & { zone: string })[] = routes.flatMap((r) =>
    r.stops.map((s) => ({ ...s, zone: r.zone }))
  );

  const completedStops = stops.filter((s) => s.status === 'completed').length;
  const progressPct = stops.length > 0 ? Math.round((completedStops / stops.length) * 100) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Today's Route" description="Loading..." />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today's Route"
        description={stops.length > 0 ? `${completedStops} of ${stops.length} stops completed` : 'No stops scheduled for today'}
      >
        <Button variant="outline">
          <Route className="mr-2 h-4 w-4" />
          Optimize Route
        </Button>
      </PageHeader>

      {stops.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Route Progress</span>
              <span className="font-medium">{progressPct}%</span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {stops.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Route className="mx-auto h-10 w-10 mb-3 opacity-50" />
            <p className="font-medium">No route assigned for today</p>
            <p className="text-sm mt-1">Routes will appear here once assigned by admin</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {stops.map((stop, index) => {
          const isActive = stop.status === 'pending' && index === completedStops;
          return (
            <div key={stop.id ?? index} className="flex gap-4">
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    stop.status === 'completed' && 'bg-primary text-primary-foreground',
                    isActive && 'bg-primary/20 text-primary border-2 border-primary',
                    stop.status === 'pending' && !isActive && 'bg-muted text-muted-foreground',
                    stop.status === 'skipped' && 'bg-muted text-muted-foreground line-through'
                  )}
                >
                  {stop.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < stops.length - 1 && (
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
                        <span className="text-sm font-medium">#{stop.orderId}</span>
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
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{stop.scheduledTime}</span>
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
