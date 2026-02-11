import { useState, useEffect } from "react";
import { PageHeader, DataTable, ExportButton, DateRangePicker } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getSalesReport,
  getZonePerformance,
  getDriverPerformance,
  getCustomerDemographics,
  getRevenueByItemType,
} from "@/services/reportService";
import type {
  SalesReportData,
  ZonePerformance,
  DriverPerformanceData,
  CustomerDemographic,
  RevenueByItemType,
} from "@/types";

// ── Column Definitions ───────────────────────────────────────────────

const salesColumns: Column<SalesReportData>[] = [
  { key: "date", header: "Date", sortable: true },
  { key: "orders", header: "Orders", sortable: true },
  {
    key: "revenue",
    header: "Revenue",
    sortable: true,
    render: (row) => `KES ${row.revenue.toLocaleString()}`,
  },
  {
    key: "avgOrderValue",
    header: "Avg Order Value",
    sortable: true,
    render: (row) => `KES ${row.avgOrderValue.toLocaleString()}`,
  },
];

const zoneColumns: Column<ZonePerformance>[] = [
  { key: "zone", header: "Zone", sortable: true },
  { key: "orders", header: "Orders", sortable: true },
  {
    key: "revenue",
    header: "Revenue",
    sortable: true,
    render: (row) => `KES ${row.revenue.toLocaleString()}`,
  },
  {
    key: "customerSatisfaction",
    header: "Satisfaction",
    sortable: true,
    render: (row) => `${row.customerSatisfaction}%`,
  },
  {
    key: "avgDeliveryTime",
    header: "Avg Delivery",
    sortable: true,
    render: (row) => `${row.avgDeliveryTime} hrs`,
  },
  {
    key: "onTimeRate",
    header: "On-Time Rate",
    sortable: true,
    render: (row) => `${row.onTimeRate}%`,
  },
];

const driverColumns: Column<DriverPerformanceData>[] = [
  { key: "name", header: "Driver", sortable: true },
  { key: "deliveries", header: "Total Deliveries", sortable: true },
  {
    key: "onTimeRate",
    header: "On-Time Rate",
    sortable: true,
    render: (row) => `${row.onTimeRate}%`,
  },
  { key: "avgRating", header: "Rating", sortable: true },
  {
    key: "fuelCost",
    header: "Fuel Cost",
    sortable: true,
    render: (row) => `KES ${row.fuelCost.toLocaleString()}`,
  },
];

const customerColumns: Column<CustomerDemographic>[] = [
  { key: "segment", header: "Segment" },
  { key: "count", header: "Customers", sortable: true },
  {
    key: "percentage",
    header: "Percentage",
    sortable: true,
    render: (row) => `${row.percentage}%`,
  },
  {
    key: "avgOrderValue",
    header: "Avg Order Value",
    sortable: true,
    render: (row) => `KES ${row.avgOrderValue.toLocaleString()}`,
  },
];

// ── Loading Skeleton ─────────────────────────────────────────────────

const TableSkeleton = () => (
  <Card className="bg-card border-border/50">
    <CardHeader>
      <Skeleton className="h-6 w-48" />
    </CardHeader>
    <CardContent className="space-y-3">
      {/* Header row */}
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: 4 }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </CardContent>
  </Card>
);

const RevenueSkeleton = () => (
  <Card className="bg-card border-border/50">
    <CardHeader>
      <Skeleton className="h-6 w-48" />
    </CardHeader>
    <CardContent className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      ))}
    </CardContent>
  </Card>
);

// ── Component ────────────────────────────────────────────────────────

/**
 * Admin Reports & Analytics Page
 * Tabs for Sales, Revenue, Zones, Drivers, and Customers.
 * All data is fetched from Supabase via reportService.
 */
export const ReportsAnalytics = () => {
  const [dateRange, setDateRange] = useState({ start: "2024-01-01", end: "2024-12-31" });

  // Data state
  const [salesData, setSalesData] = useState<SalesReportData[]>([]);
  const [zoneData, setZoneData] = useState<ZonePerformance[]>([]);
  const [driverData, setDriverData] = useState<DriverPerformanceData[]>([]);
  const [customerData, setCustomerData] = useState<CustomerDemographic[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueByItemType[]>([]);

  // Loading state
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingZones, setLoadingZones] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingRevenue, setLoadingRevenue] = useState(true);

  // Fetch all report data on mount
  useEffect(() => {
    const fetchSales = async () => {
      setLoadingSales(true);
      try {
        const data = await getSalesReport();
        setSalesData(data);
      } finally {
        setLoadingSales(false);
      }
    };

    const fetchZones = async () => {
      setLoadingZones(true);
      try {
        const data = await getZonePerformance();
        setZoneData(data);
      } finally {
        setLoadingZones(false);
      }
    };

    const fetchDrivers = async () => {
      setLoadingDrivers(true);
      try {
        const data = await getDriverPerformance();
        setDriverData(data);
      } finally {
        setLoadingDrivers(false);
      }
    };

    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const data = await getCustomerDemographics();
        setCustomerData(data);
      } finally {
        setLoadingCustomers(false);
      }
    };

    const fetchRevenue = async () => {
      setLoadingRevenue(true);
      try {
        const data = await getRevenueByItemType();
        setRevenueData(data);
      } finally {
        setLoadingRevenue(false);
      }
    };

    fetchSales();
    fetchZones();
    fetchDrivers();
    fetchCustomers();
    fetchRevenue();
  }, []);

  // Compute the total revenue for percentage bar widths
  const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" description="Comprehensive business intelligence and insights" />

      {/* Date Range Picker */}
      <DateRangePicker
        startDate={dateRange.start}
        endDate={dateRange.end}
        onRangeChange={(start, end) => setDateRange({ start, end })}
      />

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-4">
          <div className="flex justify-end">
            <ExportButton data={salesData} filename="sales-report" />
          </div>
          {loadingSales ? (
            <TableSkeleton />
          ) : (
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Monthly Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable data={salesData} columns={salesColumns} searchable={false} pageSize={12} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="flex justify-end">
            <ExportButton data={revenueData} filename="revenue-report" />
          </div>
          {loadingRevenue ? (
            <RevenueSkeleton />
          ) : (
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Revenue by Item Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {revenueData.map((item) => {
                    const pct = totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 0;
                    return (
                      <div key={item.itemType} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{item.itemType}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">{item.orders} orders</span>
                            <span className="text-muted-foreground">
                              Avg KES {item.avgPrice.toLocaleString()}
                            </span>
                            <span className="font-medium text-foreground w-32 text-right">
                              KES {item.revenue.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2.5">
                          <div
                            className="h-2.5 rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Zones Tab */}
        <TabsContent value="zones" className="space-y-4">
          <div className="flex justify-end">
            <ExportButton data={zoneData} filename="zone-report" />
          </div>
          {loadingZones ? (
            <TableSkeleton />
          ) : (
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Zone Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable data={zoneData} columns={zoneColumns} searchable={false} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Drivers Tab */}
        <TabsContent value="drivers" className="space-y-4">
          <div className="flex justify-end">
            <ExportButton data={driverData} filename="driver-report" />
          </div>
          {loadingDrivers ? (
            <TableSkeleton />
          ) : (
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Driver Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable data={driverData} columns={driverColumns} searchable={false} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex justify-end">
            <ExportButton data={customerData} filename="customer-report" />
          </div>
          {loadingCustomers ? (
            <TableSkeleton />
          ) : (
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Customer Segmentation</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable data={customerData} columns={customerColumns} searchable={false} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsAnalytics;
