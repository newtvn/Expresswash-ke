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

const initialNotifications: Notification[] = [
  { id: '1', type: 'order', title: 'Order Processing', message: 'Your order EW-2025-00412 is now being washed.', timestamp: '2 hours ago', read: false },
  { id: '2', type: 'delivery', title: 'Pickup Completed', message: 'Driver James Kiprop has picked up your items for order EW-2025-00412.', timestamp: '5 hours ago', read: false },
  { id: '3', type: 'loyalty', title: 'Points Earned', message: 'You earned 120 loyalty points from order EW-2025-00408.', timestamp: '1 day ago', read: false },
  { id: '4', type: 'promo', title: 'Weekend Special!', message: 'Get 15% off all carpet cleaning this weekend. Use code WEEKEND15.', timestamp: '1 day ago', read: true },
  { id: '5', type: 'payment', title: 'Payment Received', message: 'Payment of KES 2,200 received for invoice INV-2025-0042 via M-Pesa.', timestamp: '2 days ago', read: true },
  { id: '6', type: 'order', title: 'Order Delivered', message: 'Your order EW-2025-00380 has been delivered. Please confirm receipt.', timestamp: '3 days ago', read: true },
  { id: '7', type: 'loyalty', title: 'Tier Upgrade!', message: 'Congratulations! You have been upgraded to Silver tier.', timestamp: '5 days ago', read: true },
  { id: '8', type: 'promo', title: 'New Year Offer', message: 'Start the year fresh! 20% off on all services for returning customers.', timestamp: '1 week ago', read: true },
  { id: '9', type: 'alert', title: 'Invoice Due Soon', message: 'Invoice INV-2025-0045 for KES 3,500 is due in 3 days.', timestamp: '1 week ago', read: true },
  { id: '10', type: 'delivery', title: 'Quality Check Passed', message: 'Items from order EW-2025-00350 have passed quality inspection.', timestamp: '2 weeks ago', read: true },
  { id: '11', type: 'promo', title: 'Refer a Friend', message: 'Invite friends to ExpressWash and earn 200 bonus points each!', timestamp: '2 weeks ago', read: true },
  { id: '12', type: 'payment', title: 'Payment Confirmed', message: 'Payment of KES 4,500 received for invoice INV-2025-0025.', timestamp: '3 weeks ago', read: true },
  { id: '13', type: 'order', title: 'Order Confirmed', message: 'Your order EW-2025-00350 has been confirmed. Pickup scheduled for tomorrow.', timestamp: '3 weeks ago', read: true },
  { id: '14', type: 'loyalty', title: 'Bonus Points', message: 'You received 50 bonus points for your 10th order. Thank you!', timestamp: '1 month ago', read: true },
  { id: '15', type: 'promo', title: 'Holiday Discount', message: 'Enjoy 25% off curtain cleaning for the festive season.', timestamp: '1 month ago', read: true },
];

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
    </div>
  );
};

export default Notifications;
