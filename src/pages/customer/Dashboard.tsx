import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, KPICard } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/hooks/useAuth';
import { getOrdersByCustomer } from '@/services/orderService';
import type { Order } from '@/types';
import {
  Package,
  Clock,
  CheckCircle2,
  TrendingUp,
  Truck,
  ArrowRight,
  Plus,
} from 'lucide-react';

const statusLabels: Record<number, string> = {
  0: 'Cancelled',
  1: 'Pending',
  2: 'Driver Assigned',
  3: 'Picked Up',
  4: 'At Warehouse',
  5: 'Processing',
  6: 'Quality Check',
  7: 'Ready for Delivery',
  8: 'Out for Delivery',
  9: 'Delivered',
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    getOrdersByCustomer(user.id, { page: 1, limit: 10 })
      .then((res) => setOrders(res.data))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const activeOrders = orders.filter((o) => o.status >= 1 && o.status <= 8);
  const completedOrders = orders.filter((o) => o.status === 9);
  const recentOrders = orders.slice(0, 5);
  const totalSpent = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Welcome back, ${user?.name ?? 'Customer'}`}>
        <Button onClick={() => navigate(ROUTES.CUSTOMER_REQUEST_PICKUP)}>
          <Plus className="w-4 h-4 mr-2" />
          Request Pickup
        </Button>
      </PageHeader>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Active Orders" value={activeOrders.length} change={0} changeDirection="flat" icon={Package} />
          <KPICard label="Completed" value={completedOrders.length} change={0} changeDirection="flat" icon={CheckCircle2} />
          <KPICard label="Total Orders" value={orders.length} change={0} changeDirection="flat" icon={TrendingUp} />
          <KPICard label="Total Spent" value={totalSpent} change={0} changeDirection="flat" format="currency" icon={Clock} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Recent Orders</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.CUSTOMER_ORDERS)}>
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="text-center py-10">
                  <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No orders yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate(ROUTES.CUSTOMER_REQUEST_PICKUP)}
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    Request Your First Pickup
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <div
                      key={order.trackingCode}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/portal/orders/${order.trackingCode}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">#{order.trackingCode}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.items.length} item{order.items.length !== 1 ? 's' : ''} - {order.zone}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {order.total != null && (
                          <span className="text-sm font-medium">
                            KES {order.total.toLocaleString()}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            order.status === 9
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : order.status === 0
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : 'bg-blue-100 text-blue-700 border-blue-200'
                          }
                        >
                          {statusLabels[order.status] ?? 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate(ROUTES.CUSTOMER_REQUEST_PICKUP)}
            >
              <Truck className="mr-2 h-4 w-4" />
              Request Pickup
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate(ROUTES.TRACK_ORDER)}
            >
              <Package className="mr-2 h-4 w-4" />
              Track Order
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate(ROUTES.CUSTOMER_INVOICES)}
            >
              <Clock className="mr-2 h-4 w-4" />
              View Invoices
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
