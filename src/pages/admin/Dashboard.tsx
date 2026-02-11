import { useState, useEffect } from 'react';
import { PageHeader, KPICard } from '@/components/shared';
import { SalesChart, OrderStatusPieChart } from '@/components/reports';
import { RecentOrdersTable } from '@/components/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingCart,
  Users,
  DollarSign,
  Star,
} from 'lucide-react';
import { getKPIs, getSalesReport } from '@/services/reportService';
import { getOrders } from '@/services/orderService';
import type { KPIData, SalesReportData, Order } from '@/types';
import type { LucideIcon } from 'lucide-react';

// Map KPI labels to icons
const kpiIconMap: Record<string, LucideIcon> = {
  'Total Revenue': DollarSign,
  'Active Orders': ShoppingCart,
  'Total Customers': Users,
  'Avg Rating': Star,
};

// Status labels for the order status breakdown
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

// Colors for the pie chart slices
const statusColors: Record<number, string> = {
  0: '#ef4444',
  1: '#f59e0b',
  2: '#3b82f6',
  3: '#8b5cf6',
  4: '#06b6d4',
  5: '#0d9488',
  6: '#14b8a6',
  7: '#10b981',
  8: '#0891b2',
  9: '#22c55e',
};

/**
 * Derive order status distribution from an array of orders.
 */
function deriveOrderStatusData(orders: Order[]) {
  const counts: Record<number, number> = {};
  for (const order of orders) {
    counts[order.status] = (counts[order.status] || 0) + 1;
  }
  return Object.entries(counts).map(([statusKey, count]) => {
    const status = Number(statusKey);
    return {
      status: statusLabels[status] ?? `Status ${status}`,
      count,
      color: statusColors[status] ?? '#94a3b8',
    };
  });
}

/**
 * Admin Dashboard
 * KPI cards, SalesChart, OrderStatusPieChart, and RecentOrdersTable.
 * All data is fetched from Supabase via service functions.
 */
export const Dashboard = () => {
  const [kpis, setKpis] = useState<KPIData[]>([]);
  const [salesData, setSalesData] = useState<SalesReportData[]>([]);
  const [recentOrders, setRecentOrders] = useState<(Order & { amount?: number })[]>([]);
  const [orderStatusData, setOrderStatusData] = useState<
    { status: string; count: number; color: string }[]
  >([]);

  const [kpisLoading, setKpisLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Fetch KPIs
  useEffect(() => {
    let cancelled = false;
    const fetchKPIs = async () => {
      try {
        const data = await getKPIs();
        if (!cancelled) setKpis(data);
      } catch {
        // silently handle errors; KPI cards will show empty
      } finally {
        if (!cancelled) setKpisLoading(false);
      }
    };
    fetchKPIs();
    return () => { cancelled = true; };
  }, []);

  // Fetch sales report
  useEffect(() => {
    let cancelled = false;
    const fetchSales = async () => {
      try {
        const data = await getSalesReport();
        if (!cancelled) setSalesData(data);
      } catch {
        // silently handle errors; chart will show empty state
      } finally {
        if (!cancelled) setSalesLoading(false);
      }
    };
    fetchSales();
    return () => { cancelled = true; };
  }, []);

  // Fetch recent orders (also used to derive order status distribution)
  useEffect(() => {
    let cancelled = false;
    const fetchOrders = async () => {
      try {
        const response = await getOrders({ page: 1, limit: 5 });
        if (!cancelled) {
          const ordersWithAmount = response.data.map((order) => ({
            ...order,
            amount: order.total,
          }));
          setRecentOrders(ordersWithAmount);
          setOrderStatusData(deriveOrderStatusData(response.data));
        }
      } catch {
        // silently handle errors; table will show empty state
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    };
    fetchOrders();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your business performance"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpisLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-card border-border/50">
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-20" />
                </CardContent>
              </Card>
            ))
          : kpis.map((kpi) => (
              <KPICard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                change={kpi.change}
                changeDirection={kpi.changeDirection}
                format={kpi.format}
                icon={kpiIconMap[kpi.label]}
              />
            ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {salesLoading ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sales Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[350px] w-full" />
            </CardContent>
          </Card>
        ) : (
          <SalesChart data={salesData} />
        )}

        {ordersLoading ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[380px] w-full" />
            </CardContent>
          </Card>
        ) : (
          <OrderStatusPieChart data={orderStatusData} />
        )}
      </div>

      {/* Recent Orders */}
      {ordersLoading ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <RecentOrdersTable orders={recentOrders} />
      )}
    </div>
  );
};

export default Dashboard;
