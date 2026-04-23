import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bell,
  Package,
  Truck,
  MapPin,
  Check,
  Loader2,
  Navigation,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllAsRead as markAllAsReadService,
} from '@/services/notificationService';
import type { Notification } from '@/services/notificationService';
import { formatDistanceToNow } from 'date-fns';

const iconMap: Record<string, React.ElementType> = {
  driver_assigned: Truck,
  pickup_scheduled: MapPin,
  picked_up: Package,
  out_for_delivery: Navigation,
  delivered: ClipboardCheck,
  general: Bell,
  order_created: Package,
  in_processing: Package,
  ready_for_delivery: Package,
  price_updated: Package,
};

export const DriverNotifications = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['driver-notifications', user?.id, filter],
    queryFn: () => getUserNotifications(user!.id, filter === 'unread'),
    enabled: !!user?.id,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['driver-notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllAsReadService(user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['driver-notifications'] }),
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description={`You have ${unreadCount} unread notification(s)`}>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            {markAllMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Mark All as Read
          </Button>
        )}
      </PageHeader>

      <div className="flex gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const Icon = iconMap[notification.type] ?? Bell;
            return (
              <Card
                key={notification.id}
                className={cn(
                  'transition-colors cursor-pointer hover:shadow-sm',
                  !notification.read && 'border-primary/30 bg-primary/5'
                )}
                onClick={() => {
                  if (!notification.read) markReadMutation.mutate(notification.id);
                }}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                        !notification.read ? 'bg-primary/10' : 'bg-muted'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', !notification.read ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn('text-sm', !notification.read ? 'font-semibold' : 'font-medium')}>
                          {notification.title}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          {!notification.read && (
                            <Badge variant="default" className="text-xs h-5">New</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DriverNotifications;
