import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, KPICard } from '@/components/shared';
import { RecentOrdersTable } from '@/components/admin';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Star,
  Clock,
  Truck,
  FileWarning,
  AlertTriangle,
} from 'lucide-react';
import { getDashboardKPIs, getSalesData, getOrderStatusCounts } from '@/services/reportService';
import { getOrders } from '@/services/orderService';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load heavy chart components (recharts library is ~140KB)
const SalesChart = lazy(() =>
  import('@/components/reports').then((module) => ({ default: module.SalesChart }))
);
const OrderStatusPieChart = lazy(() =>
  import('@/components/reports').then((module) => ({ default: module.OrderStatusPieChart }))
);

export const Dashboard = () => {
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['admin', 'dashboard', 'kpis'],
    queryFn: getDashboardKPIs,
    refetchInterval: 60_000,
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
          label: 'Revenue Today',
          value: kpis.revenueToday,
          icon: DollarSign,
          format: 'currency' as const,
        },
        {
          label: 'Orders Today',
          value: kpis.ordersToday,
          icon: ShoppingCart,
          format: 'number' as const,
        },
        {
          label: 'In Progress',
          value: kpis.ordersInProgress,
          icon: Truck,
          format: 'number' as const,
        },
        {
          label: 'Pending',
          value: kpis.ordersPending,
          icon: Clock,
          format: 'number' as const,
        },
        {
          label: 'Total Revenue',
          value: kpis.totalRevenue,
          icon: DollarSign,
          format: 'currency' as const,
        },
        {
          label: 'Total Customers',
          value: kpis.totalCustomers,
          icon: Users,
          format: 'number' as const,
        },
        {
          label: 'Unpaid Invoices',
          value: kpis.unpaidInvoices,
          icon: FileWarning,
          format: 'number' as const,
        },
        {
          label: 'Avg Rating',
          value: kpis.avgRating,
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
          ? Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))
          : kpiCards.map((kpi) => <KPICard key={kpi.label} {...kpi} />)}
      </div>

      {kpis && kpis.slaBreachesToday > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{kpis.slaBreachesToday} SLA breach{kpis.slaBreachesToday > 1 ? 'es' : ''} today</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
          <SalesChart data={salesData} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
          <OrderStatusPieChart data={statusCounts} />
        </Suspense>
      </div>

      <RecentOrdersTable orders={recentOrders} />
    </div>
  );
};

export default Dashboard;
