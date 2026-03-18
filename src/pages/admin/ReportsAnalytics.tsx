import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, DataTable, ExportButton, DateRangePicker, KPICard } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Truck,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { queryKeys } from '@/config/queryKeys';
import {
  getRevenueReport,
  getOrderReport,
  getDriverPerformanceReport,
  getCustomerReport,
  getFinancialReport,
} from '@/services/reportService';
import type {
  DriverPerformanceRow,
  FinancialReportData,
} from '@/services/reportService';

// ── Helpers ──────────────────────────────────────────────────────────

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const fmt = (d: Date) => d.toISOString().split('T')[0];

// ── Column Definitions ───────────────────────────────────────────────

type PeriodRow = { period: string; payments: number; revenue: number };
const periodColumns: Column<PeriodRow>[] = [
  { key: 'period', header: 'Period', sortable: true },
  { key: 'payments', header: 'Payments', sortable: true },
  {
    key: 'revenue',
    header: 'Revenue',
    sortable: true,
    render: (row) => `KES ${Number(row.revenue).toLocaleString()}`,
  },
];

type PaymentMethodRow = { method: string; count: number; revenue: number };
const paymentMethodColumns: Column<PaymentMethodRow>[] = [
  { key: 'method', header: 'Payment Method', sortable: true, render: (row) => <span className="capitalize">{row.method.replace('_', ' ')}</span> },
  { key: 'count', header: 'Count', sortable: true },
  { key: 'revenue', header: 'Revenue', sortable: true, render: (row) => `KES ${Number(row.revenue).toLocaleString()}` },
];

type ZoneRevenueRow = { zone: string; orders: number; revenue: number };
const zoneRevenueColumns: Column<ZoneRevenueRow>[] = [
  { key: 'zone', header: 'Zone', sortable: true },
  { key: 'orders', header: 'Orders', sortable: true },
  { key: 'revenue', header: 'Revenue', sortable: true, render: (row) => `KES ${Number(row.revenue).toLocaleString()}` },
];

const driverColumns: Column<DriverPerformanceRow>[] = [
  { key: 'name', header: 'Driver', sortable: true },
  { key: 'deliveries', header: 'Deliveries', sortable: true },
  { key: 'pickups', header: 'Pickups', sortable: true },
  { key: 'avg_rating', header: 'Avg Rating', sortable: true },
  {
    key: 'cash_collected',
    header: 'Cash Collected',
    sortable: true,
    render: (row) => `KES ${Number(row.cash_collected).toLocaleString()}`,
  },
  {
    key: 'cancellation_rate',
    header: 'Cancel %',
    sortable: true,
    render: (row) => `${row.cancellation_rate}%`,
  },
];

type TopCustomerRow = { name: string; order_count: number; total_spent: number };
const topCustomerColumns: Column<TopCustomerRow>[] = [
  { key: 'name', header: 'Customer', sortable: true },
  { key: 'order_count', header: 'Orders', sortable: true },
  {
    key: 'total_spent',
    header: 'Total Spent',
    sortable: true,
    render: (row) => `KES ${Number(row.total_spent).toLocaleString()}`,
  },
];

type ExpenseCategoryRow = { category: string; total: number; count: number };
const expenseCategoryColumns: Column<ExpenseCategoryRow>[] = [
  { key: 'category', header: 'Category', sortable: true, render: (row) => <span className="capitalize">{row.category.replace('_', ' ')}</span> },
  { key: 'count', header: 'Count', sortable: true },
  { key: 'total', header: 'Total', sortable: true, render: (row) => `KES ${Number(row.total).toLocaleString()}` },
];

// ── Loading Skeletons ────────────────────────────────────────────────

const TableSkeleton = () => (
  <Card className="bg-card border-border/50">
    <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
    <CardContent className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-4 flex-1" />)}
        </div>
      ))}
    </CardContent>
  </Card>
);

// ── Component ────────────────────────────────────────────────────────

export const ReportsAnalytics = () => {
  const [dateRange, setDateRange] = useState({
    start: fmt(thirtyDaysAgo),
    end: fmt(today),
  });

  const { data: revenueData, isLoading: loadingRevenue } = useQuery({
    queryKey: queryKeys.reports.revenue({ ...dateRange }),
    queryFn: () => getRevenueReport(dateRange.start, dateRange.end),
  });

  const { data: orderData, isLoading: loadingOrders } = useQuery({
    queryKey: queryKeys.reports.sales({ ...dateRange }),
    queryFn: () => getOrderReport(dateRange.start, dateRange.end),
  });

  const { data: driverData, isLoading: loadingDrivers } = useQuery({
    queryKey: queryKeys.reports.drivers({ ...dateRange }),
    queryFn: () => getDriverPerformanceReport(dateRange.start, dateRange.end),
  });

  const { data: customerData, isLoading: loadingCustomers } = useQuery({
    queryKey: queryKeys.reports.customers({ ...dateRange }),
    queryFn: () => getCustomerReport(dateRange.start, dateRange.end),
  });

  const { data: financialData, isLoading: loadingFinancial } = useQuery({
    queryKey: [...queryKeys.reports.all, 'financial', dateRange],
    queryFn: () => getFinancialReport(dateRange.start, dateRange.end),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" description="Comprehensive business intelligence and insights" />

      <DateRangePicker
        startDate={dateRange.start}
        endDate={dateRange.end}
        onRangeChange={(start, end) => setDateRange({ start, end })}
      />

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        {/* Sales / Revenue Tab */}
        <TabsContent value="sales" className="space-y-4">
          {loadingRevenue ? <TableSkeleton /> : revenueData && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KPICard label="Total Revenue" value={revenueData.summary.total_revenue} format="currency" icon={DollarSign} />
                <KPICard label="Total Payments" value={revenueData.summary.total_payments} format="number" icon={ShoppingCart} />
                <KPICard label="Avg Payment" value={Math.round(revenueData.summary.avg_payment)} format="currency" icon={TrendingUp} />
              </div>
              <div className="flex justify-end">
                <ExportButton data={revenueData.by_period} filename="revenue-by-period" />
              </div>
              <Card className="bg-card border-border/50">
                <CardHeader><CardTitle className="text-lg font-semibold">Revenue by Period</CardTitle></CardHeader>
                <CardContent>
                  <DataTable data={revenueData.by_period} columns={periodColumns} searchable={false} pageSize={15} />
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardHeader><CardTitle className="text-lg font-semibold">Revenue by Payment Method</CardTitle></CardHeader>
                <CardContent>
                  <DataTable data={revenueData.by_payment_method} columns={paymentMethodColumns} searchable={false} />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          {loadingOrders ? <TableSkeleton /> : orderData && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <KPICard label="Total Orders" value={orderData.totals.total_orders} format="number" icon={ShoppingCart} />
                <KPICard label="Completed" value={orderData.totals.completed} format="number" icon={ShoppingCart} />
                <KPICard label="In Progress" value={orderData.totals.in_progress} format="number" icon={Truck} />
                <KPICard label="Cancelled" value={orderData.totals.cancelled} format="number" icon={AlertTriangle} />
              </div>
              {orderData.sla_compliance.total_with_sla > 0 && (
                <Card className="bg-card border-border/50">
                  <CardHeader><CardTitle className="text-lg font-semibold">SLA Compliance</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-foreground">{orderData.sla_compliance.total_with_sla}</p>
                        <p className="text-sm text-muted-foreground">Orders with SLA</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{orderData.sla_compliance.met_sla}</p>
                        <p className="text-sm text-muted-foreground">Met SLA</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-500">{orderData.sla_compliance.breached_sla}</p>
                        <p className="text-sm text-muted-foreground">Breached SLA</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <div className="flex justify-end">
                <ExportButton data={orderData.status_breakdown} filename="order-status-breakdown" />
              </div>
              <Card className="bg-card border-border/50">
                <CardHeader><CardTitle className="text-lg font-semibold">Status Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <DataTable
                    data={orderData.status_breakdown}
                    columns={[
                      { key: 'status_name', header: 'Status', sortable: true },
                      { key: 'count', header: 'Count', sortable: true },
                    ]}
                    searchable={false}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Zones Tab */}
        <TabsContent value="zones" className="space-y-4">
          {loadingRevenue ? <TableSkeleton /> : revenueData && (
            <>
              <div className="flex justify-end">
                <ExportButton data={revenueData.by_zone} filename="zone-revenue" />
              </div>
              <Card className="bg-card border-border/50">
                <CardHeader><CardTitle className="text-lg font-semibold">Revenue by Zone</CardTitle></CardHeader>
                <CardContent>
                  <DataTable data={revenueData.by_zone} columns={zoneRevenueColumns} searchable={false} />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Drivers Tab */}
        <TabsContent value="drivers" className="space-y-4">
          {loadingDrivers ? <TableSkeleton /> : (
            <>
              <div className="flex justify-end">
                <ExportButton data={driverData ?? []} filename="driver-performance" />
              </div>
              <Card className="bg-card border-border/50">
                <CardHeader><CardTitle className="text-lg font-semibold">Driver Performance</CardTitle></CardHeader>
                <CardContent>
                  <DataTable data={driverData ?? []} columns={driverColumns} searchable={false} />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          {loadingCustomers ? <TableSkeleton /> : customerData && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KPICard label="Total Customers" value={customerData.total_customers} format="number" icon={Users} />
                <KPICard label="New This Period" value={customerData.new_customers_period} format="number" icon={Users} />
                <KPICard label="Avg Review Rating" value={customerData.avg_review_rating} format="number" icon={TrendingUp} />
              </div>
              {customerData.tier_distribution.length > 0 && (
                <Card className="bg-card border-border/50">
                  <CardHeader><CardTitle className="text-lg font-semibold">Loyalty Tier Distribution</CardTitle></CardHeader>
                  <CardContent>
                    <DataTable
                      data={customerData.tier_distribution}
                      columns={[
                        { key: 'tier', header: 'Tier', sortable: true, render: (row: { tier: string }) => <span className="capitalize">{row.tier}</span> },
                        { key: 'count', header: 'Customers', sortable: true },
                      ]}
                      searchable={false}
                    />
                  </CardContent>
                </Card>
              )}
              <div className="flex justify-end">
                <ExportButton data={customerData.top_customers} filename="top-customers" />
              </div>
              <Card className="bg-card border-border/50">
                <CardHeader><CardTitle className="text-lg font-semibold">Top Customers</CardTitle></CardHeader>
                <CardContent>
                  <DataTable data={customerData.top_customers} columns={topCustomerColumns} searchable={false} pageSize={10} />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-4">
          {loadingFinancial ? <TableSkeleton /> : financialData && (
            <FinancialTab data={financialData} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const FinancialTab = ({ data }: { data: FinancialReportData }) => (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <KPICard label="Total Revenue" value={data.total_revenue} format="currency" icon={DollarSign} />
      <KPICard label="Total Expenses" value={data.total_expenses} format="currency" icon={DollarSign} />
      <KPICard label="Gross Profit" value={data.gross_profit} format="currency" icon={TrendingUp} />
      <KPICard label="Profit Margin" value={data.profit_margin} format="percentage" icon={TrendingUp} />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <KPICard label="Outstanding Receivables" value={data.outstanding_receivables} format="currency" icon={AlertTriangle} />
      <KPICard label="Overdue Invoices" value={data.overdue_count} format="number" icon={AlertTriangle} />
    </div>
    {data.expenses_by_category.length > 0 && (
      <>
        <div className="flex justify-end">
          <ExportButton data={data.expenses_by_category} filename="expenses-by-category" />
        </div>
        <Card className="bg-card border-border/50">
          <CardHeader><CardTitle className="text-lg font-semibold">Expenses by Category</CardTitle></CardHeader>
          <CardContent>
            <DataTable data={data.expenses_by_category} columns={expenseCategoryColumns} searchable={false} />
          </CardContent>
        </Card>
      </>
    )}
  </>
);

export default ReportsAnalytics;
