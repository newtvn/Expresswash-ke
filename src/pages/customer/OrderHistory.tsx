import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, StatusBadge, SearchInput } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Eye, MapPin, Calendar, Package } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getCustomerOrders } from '@/services/orderService';
import { ROUTES } from '@/config/routes';
import { PlaceOrderDialog } from '@/components/customer/PlaceOrderDialog';

export const OrderHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [placeOrderOpen, setPlaceOrderOpen] = useState(false);

  const { data: result, isLoading } = useQuery({
    queryKey: ['customer', 'orders', user?.id, search, statusFilter],
    queryFn: () =>
      getCustomerOrders(user!.id, {
        search: search || undefined,
        status: statusFilter !== 'all' ? Number(statusFilter) : undefined,
        page: 1,
        limit: 50,
      }),
    enabled: !!user?.id,
  });

  const orders = result?.data ?? [];

  const statusLabel = (status: number): string => {
    const map: Record<number, string> = {
      0: 'Cancelled', 1: 'Pending', 2: 'Driver Assigned', 3: 'Accepted',
      4: 'Pickup Scheduled', 5: 'Picked Up', 6: 'In Washing', 7: 'Drying',
      8: 'Quality Check', 9: 'Ready', 10: 'Dispatched', 11: 'Out for Delivery', 12: 'Delivered',
    };
    return map[status] ?? 'Unknown';
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Orders" description="Track and manage all your cleaning orders">
        <Button onClick={() => setPlaceOrderOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Place Order
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-3">
        <SearchInput onSearch={useCallback((v: string) => setSearch(v), [])} placeholder="Search by tracking code..." className="w-64" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="1">Pending</SelectItem>
            <SelectItem value="5">Picked Up</SelectItem>
            <SelectItem value="6">In Washing</SelectItem>
            <SelectItem value="9">Ready</SelectItem>
            <SelectItem value="12">Delivered</SelectItem>
            <SelectItem value="0">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No orders found</p>
          <p className="text-sm mt-1">Place your first order to get started</p>
          <Button className="mt-4" onClick={() => setPlaceOrderOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Place Order
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.trackingCode} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/portal/orders/${order.trackingCode}`)}>
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{order.trackingCode}</span>
                    <StatusBadge status={String(order.status)} />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{order.pickupDate}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{order.zone}</span>
                    <span className="flex items-center gap-1"><Package className="h-3 w-3" />{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/portal/orders/${order.trackingCode}`); }}>
                  <Eye className="h-4 w-4 mr-1" /> View
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlaceOrderDialog open={placeOrderOpen} onOpenChange={setPlaceOrderOpen} />
    </div>
  );
};

export default OrderHistory;
