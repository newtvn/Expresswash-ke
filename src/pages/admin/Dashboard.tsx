import { PageHeader, KPICard, DataTable, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { SalesChart, OrderStatusPieChart } from '@/components/reports';
import { RecentOrdersTable } from '@/components/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShoppingCart,
  Users,
  DollarSign,
  Star,
} from 'lucide-react';

const kpis = [
  { label: 'Total Revenue', value: 2450000, change: 12.5, changeDirection: 'up' as const, icon: DollarSign, format: 'currency' as const },
  { label: 'Active Orders', value: 187, change: 8.2, changeDirection: 'up' as const, icon: ShoppingCart, format: 'number' as const },
  { label: 'Total Customers', value: 1243, change: 5.1, changeDirection: 'up' as const, icon: Users, format: 'number' as const },
  { label: 'Avg Rating', value: '4.7', change: 0.3, changeDirection: 'up' as const, format: 'number' as const, icon: Star },
];

const mockSalesData = [
  { date: 'Jan', orders: 120, revenue: 340000, avgOrderValue: 2833 },
  { date: 'Feb', orders: 145, revenue: 410000, avgOrderValue: 2827 },
  { date: 'Mar', orders: 165, revenue: 480000, avgOrderValue: 2909 },
  { date: 'Apr', orders: 138, revenue: 390000, avgOrderValue: 2826 },
  { date: 'May', orders: 178, revenue: 520000, avgOrderValue: 2921 },
  { date: 'Jun', orders: 195, revenue: 570000, avgOrderValue: 2923 },
];

const mockOrderStatusData = [
  { status: 'Pending', count: 24 },
  { status: 'In Washing', count: 38 },
  { status: 'Drying', count: 22 },
  { status: 'Delivered', count: 85 },
  { status: 'Dispatched', count: 18 },
];

const mockRecentOrders = [
  { trackingCode: 'EW-2024-001', customerName: 'Grace Wanjiku', items: [{ name: 'Carpet 5x8', quantity: 2 }], status: 6, pickupDate: '2024-12-20', estimatedDelivery: '2024-12-23', zone: 'Kitengela', amount: 4500 },
  { trackingCode: 'EW-2024-002', customerName: 'John Kamau', items: [{ name: 'Sofa Set', quantity: 1 }, { name: 'Curtains', quantity: 3 }], status: 9, pickupDate: '2024-12-19', estimatedDelivery: '2024-12-22', zone: 'Syokimau', amount: 8200 },
  { trackingCode: 'EW-2024-003', customerName: 'Mary Njeri', items: [{ name: 'Carpet 6x9', quantity: 1 }], status: 12, pickupDate: '2024-12-18', estimatedDelivery: '2024-12-21', zone: 'Athi River', amount: 3500 },
  { trackingCode: 'EW-2024-004', customerName: 'Peter Ochieng', items: [{ name: 'Duvet', quantity: 2 }], status: 3, pickupDate: '2024-12-20', estimatedDelivery: '2024-12-24', zone: 'Kitengela', amount: 2800 },
  { trackingCode: 'EW-2024-005', customerName: 'Alice Wambui', items: [{ name: 'Car Seat Covers', quantity: 4 }], status: 1, pickupDate: '2024-12-21', estimatedDelivery: '2024-12-25', zone: 'Syokimau', amount: 6000 },
];

/**
 * Admin Dashboard
 * KPI cards, SalesChart, OrderStatusPieChart, and RecentOrdersTable.
 */
export const Dashboard = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your business performance"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChart data={mockSalesData} />
        <OrderStatusPieChart data={mockOrderStatusData} />
      </div>

      {/* Recent Orders */}
      <RecentOrdersTable orders={mockRecentOrders} />
    </div>
  );
};

export default Dashboard;
