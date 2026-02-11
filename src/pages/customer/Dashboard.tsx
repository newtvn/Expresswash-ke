import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, KPICard } from '@/components/shared';
import { OrderCard } from '@/components/customer/OrderCard';
import { LoyaltyProgress } from '@/components/customer/LoyaltyProgress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/routes';
import { getCustomerOrders } from '@/services/orderService';
import { getLoyaltyAccount } from '@/services/loyaltyService';
import { ShoppingCart, Award, Wallet, Plus, MapPin, Gift } from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: ordersResult, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer', 'orders', user?.id, 'dashboard'],
    queryFn: () => getCustomerOrders(user!.id, { page: 1, limit: 4 }),
    enabled: !!user?.id,
  });

  const { data: loyalty } = useQuery({
    queryKey: ['customer', 'loyalty', user?.id],
    queryFn: () => getLoyaltyAccount(user!.id),
    enabled: !!user?.id,
  });

  const orders = ordersResult?.data ?? [];
  const activeOrders = orders.filter((o) => o.status >= 1 && o.status <= 11).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name ?? 'Customer'}!`}
        description="Here is a summary of your account activity"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="Active Orders" value={activeOrders} icon={ShoppingCart} />
        <KPICard label="Loyalty Points" value={loyalty?.points ?? user?.loyaltyPoints ?? 0} icon={Award} />
        <KPICard label="Total Spent" value={user?.totalSpent ?? 0} format="currency" icon={Wallet} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No orders yet. Place your first order!</p>
                  <Button className="mt-4" onClick={() => navigate(ROUTES.CUSTOMER_ORDERS)}>
                    <Plus className="mr-2 h-4 w-4" /> Place Order
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {orders.map((order) => (
                    <OrderCard
                      key={order.trackingCode}
                      orderNumber={order.trackingCode}
                      status={String(order.status)}
                      itemsCount={order.items.length}
                      date={order.pickupDate}
                      zone={order.zone}
                      className="cursor-pointer"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <LoyaltyProgress
            points={loyalty?.points ?? user?.loyaltyPoints ?? 0}
            tier={loyalty?.tier ?? user?.loyaltyTier ?? 'bronze'}
            tierProgress={loyalty?.tierProgress ?? 0}
            nextTier={loyalty?.nextTier ?? 'silver'}
            pointsToNextTier={loyalty?.pointsToNextTier ?? 0}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" onClick={() => navigate(ROUTES.CUSTOMER_ORDERS)}>
                <Plus className="mr-2 h-4 w-4" /> New Order
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/track')}>
                <MapPin className="mr-2 h-4 w-4" /> Track Order
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate(ROUTES.CUSTOMER_LOYALTY)}>
                <Gift className="mr-2 h-4 w-4" /> View Rewards
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
