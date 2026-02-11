import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, DataTable, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/hooks/useAuth';
import { getOrdersByCustomer } from '@/services/orderService';
import type { Order } from '@/types';
import { Plus } from 'lucide-react';

const statusLabels: Record<number, string> = {
  0: 'cancelled', 1: 'pending', 2: 'driver_assigned', 3: 'picked_up',
  4: 'at_warehouse', 5: 'processing', 6: 'quality_check',
  7: 'ready_for_delivery', 8: 'out_for_delivery', 9: 'delivered',
};

export const OrderHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    getOrdersByCustomer(user.id, { page: 1, limit: 50 })
      .then((res) => setOrders(res.data))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const activeOrders = orders.filter((o) => o.status >= 1 && o.status <= 8);
  const completedOrders = orders.filter((o) => o.status === 9);
  const cancelledOrders = orders.filter((o) => o.status === 0);

  const columns: Column<Order>[] = [
    {
      key: 'trackingCode',
      header: 'Order #',
      sortable: true,
      render: (row) => (
        <button
          className="text-primary font-medium hover:underline"
          onClick={() => navigate(`/portal/orders/${row.trackingCode}`)}
        >
          {row.trackingCode}
        </button>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (row) => (
        <span className="text-sm">
          {row.items.length} item{row.items.length !== 1 ? 's' : ''}
        </span>
      ),
    },
    { key: 'zone', header: 'Zone', sortable: true },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={statusLabels[row.status] ?? 'unknown'} />,
    },
    {
      key: 'total',
      header: 'Total (KES)',
      sortable: true,
      render: (row) => (
        <span className="font-medium">
          {row.total != null ? `KES ${row.total.toLocaleString()}` : '--'}
        </span>
      ),
    },
    { key: 'pickupDate', header: 'Pickup Date', sortable: true },
    { key: 'estimatedDelivery', header: 'Est. Delivery', sortable: true },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Orders" description="View and track all your orders" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Orders" description="View and track all your orders">
        <Button onClick={() => navigate(ROUTES.CUSTOMER_REQUEST_PICKUP)}>
          <Plus className="w-4 h-4 mr-2" />
          New Pickup
        </Button>
      </PageHeader>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All ({orders.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeOrders.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedOrders.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({cancelledOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <DataTable data={orders} columns={columns} searchPlaceholder="Search orders..." />
        </TabsContent>
        <TabsContent value="active">
          <DataTable data={activeOrders} columns={columns} searchPlaceholder="Search active orders..." />
        </TabsContent>
        <TabsContent value="completed">
          <DataTable data={completedOrders} columns={columns} searchPlaceholder="Search completed orders..." />
        </TabsContent>
        <TabsContent value="cancelled">
          <DataTable data={cancelledOrders} columns={columns} searchPlaceholder="Search cancelled orders..." />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrderHistory;
