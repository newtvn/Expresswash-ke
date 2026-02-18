import { useState } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bell,
  Package,
  Truck,
  Award,
  Gift,
  AlertCircle,
  CheckCircle,
  Tag,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'order' | 'delivery' | 'loyalty' | 'promo' | 'alert' | 'payment';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  order: Package,
  delivery: Truck,
  loyalty: Award,
  promo: Gift,
  alert: AlertCircle,
  payment: CheckCircle,
};

const initialNotifications: Notification[] = [];

export const Notifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState('all');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description={`You have ${unreadCount} unread notification(s)`}>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <Check className="mr-2 h-4 w-4" />
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

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No notifications yet</p>
        </div>
      ) : (
      <div className="space-y-3">
        {filtered.map((notification) => {
          const Icon = iconMap[notification.type] ?? Bell;
          return (
            <Card
              key={notification.id}
              className={cn(
                'transition-colors cursor-pointer hover:shadow-sm',
                !notification.read && 'border-primary/30 bg-primary/5'
              )}
              onClick={() => markAsRead(notification.id)}
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
                        <span className="text-xs text-muted-foreground">{notification.timestamp}</span>
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

export default Notifications;
