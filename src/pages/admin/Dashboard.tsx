import { useQuery } from '@tanstack/react-query';
import { PageHeader, KPICard } from '@/components/shared';
import { SalesChart, OrderStatusPieChart } from '@/components/reports';
import { RecentOrdersTable } from '@/components/admin';
import { DollarSign, ShoppingCart, Users, Star } from 'lucide-react';
import { getDashboardKPIs, getSalesData, getOrderStatusCounts } from '@/services/reportService';
import { getOrders } from '@/services/orderService';
import { Skeleton } from '@/components/ui/skeleton';

export const Dashboard = () => {
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['admin', 'dashboard', 'kpis'],
    queryFn: getDashboardKPIs,
  });

  const { data: salesData = [] } = useQuery({
    queryKey: ['admin', 'dashboard', 'sales'],
    queryFn: () => getSalesData(30),
  });

  const { data: statusCounts = [] } = useQuery({
    queryKey: ['admin', 'dashboard', 'statusCounts'],
    queryFn: getOrderStatusCounts,
  });

  const { data: recentOrdersResult } = useQuery({
    queryKey: ['admin', 'dashboard', 'recentOrders'],
    queryFn: () => getOrders({ page: 1, limit: 5 }),
  });

  const recentOrders = (recentOrdersResult?.data ?? []).map((o) => ({
    ...o,
    amount: o.total ?? 0,
  }));

  const kpiCards = kpis
    ? [
        {
          label: 'Total Revenue',
          value: kpis.totalRevenue,
          change: kpis.totalRevenueChange,
          changeDirection: 'up' as const,
          icon: DollarSign,
          format: 'currency' as const,
        },
        {
          label: 'Active Orders',
          value: kpis.activeOrders,
          change: kpis.activeOrdersChange,
          changeDirection: 'up' as const,
          icon: ShoppingCart,
          format: 'number' as const,
        },
        {
          label: 'Total Customers',
          value: kpis.totalCustomers,
          change: kpis.totalCustomersChange,
          changeDirection: 'up' as const,
          icon: Users,
          format: 'number' as const,
        },
        {
          label: 'Avg Rating',
          value: kpis.avgRating,
          change: 0.3,
          changeDirection: 'up' as const,
          icon: Star,
          format: 'number' as const,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your business performance" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpisLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))
          : kpiCards.map((kpi) => <KPICard key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChart data={salesData} />
        <OrderStatusPieChart data={statusCounts} />
      </div>

      <RecentOrdersTable orders={recentOrders} />
    </div>
  );
};

export default Dashboard;
