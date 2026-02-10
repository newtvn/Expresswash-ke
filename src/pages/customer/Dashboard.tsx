import { useNavigate } from 'react-router-dom';
import { PageHeader, KPICard } from '@/components/shared';
import { OrderCard } from '@/components/customer/OrderCard';
import { LoyaltyProgress } from '@/components/customer/LoyaltyProgress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/routes';
import {
  ShoppingCart,
  Award,
  Wallet,
  Plus,
  MapPin,
  Gift,
} from 'lucide-react';

const mockOrders = [
  { orderNumber: 'EW-2025-00412', status: 'processing', itemsCount: 3, date: '2025-01-28', zone: 'Kitengela' },
  { orderNumber: 'EW-2025-00408', status: 'picked_up', itemsCount: 1, date: '2025-01-27', zone: 'Athi River' },
  { orderNumber: 'EW-2025-00395', status: 'ready', itemsCount: 2, date: '2025-01-25', zone: 'Kitengela' },
  { orderNumber: 'EW-2025-00380', status: 'delivered', itemsCount: 4, date: '2025-01-22', zone: 'Nairobi' },
];

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name ?? 'Customer'}!`}
        description="Here is a summary of your account activity"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          label="Active Orders"
          value={3}
          change={10}
          changeDirection="up"
          icon={ShoppingCart}
        />
        <KPICard
          label="Loyalty Points"
          value={1250}
          change={15}
          changeDirection="up"
          icon={Award}
        />
        <KPICard
          label="Total Spent"
          value={45800}
          change={8}
          changeDirection="up"
          format="currency"
          icon={Wallet}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mockOrders.map((order) => (
                  <OrderCard
                    key={order.orderNumber}
                    {...order}
                    className="cursor-pointer"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loyalty + Quick Actions */}
        <div className="space-y-4">
          <LoyaltyProgress
            points={1250}
            tier="silver"
            tierProgress={62}
            nextTier="gold"
            pointsToNextTier={750}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full justify-start"
                onClick={() => navigate(ROUTES.CUSTOMER_ORDERS)}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(ROUTES.CUSTOMER_ORDERS)}
              >
                <MapPin className="mr-2 h-4 w-4" />
                Track Order
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(ROUTES.CUSTOMER_LOYALTY)}
              >
                <Gift className="mr-2 h-4 w-4" />
                View Rewards
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
