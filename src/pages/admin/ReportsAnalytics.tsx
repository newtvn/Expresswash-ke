import { useState } from "react";
import { PageHeader, DataTable, ExportButton, DateRangePicker } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// --- Sales Report Data ---
const salesByMonth = [
  { month: "Jan 2024", orders: 98, revenue: 185000, avgOrderValue: 1888 },
  { month: "Feb 2024", orders: 112, revenue: 210000, avgOrderValue: 1875 },
  { month: "Mar 2024", orders: 134, revenue: 248000, avgOrderValue: 1851 },
  { month: "Apr 2024", orders: 121, revenue: 225000, avgOrderValue: 1860 },
  { month: "May 2024", orders: 145, revenue: 275000, avgOrderValue: 1897 },
  { month: "Jun 2024", orders: 156, revenue: 298000, avgOrderValue: 1910 },
];

const salesColumns: Column<(typeof salesByMonth)[0]>[] = [
  { key: "month", header: "Month", sortable: true },
  { key: "orders", header: "Orders", sortable: true },
  { key: "revenue", header: "Revenue", sortable: true, render: (row) => `KES ${row.revenue.toLocaleString()}` },
  { key: "avgOrderValue", header: "Avg Order Value", sortable: true, render: (row) => `KES ${row.avgOrderValue.toLocaleString()}` },
];

// --- Zone Report Data ---
const zoneData = [
  { zone: "Kitengela", orders: 520, revenue: 985000, customers: 340, avgDeliveryTime: "4.2 hrs" },
  { zone: "Athi River", orders: 380, revenue: 715000, customers: 265, avgDeliveryTime: "5.8 hrs" },
  { zone: "Nairobi", orders: 284, revenue: 580000, customers: 195, avgDeliveryTime: "26.4 hrs" },
];

const zoneColumns: Column<(typeof zoneData)[0]>[] = [
  { key: "zone", header: "Zone", sortable: true },
  { key: "orders", header: "Orders", sortable: true },
  { key: "revenue", header: "Revenue", sortable: true, render: (row) => `KES ${row.revenue.toLocaleString()}` },
  { key: "customers", header: "Customers", sortable: true },
  { key: "avgDeliveryTime", header: "Avg Delivery" },
];

// --- Driver Report Data ---
const driverData = [
  { name: "Joseph Mwangi", deliveries: 342, onTime: 328, rating: 4.8, zone: "Kitengela" },
  { name: "Samuel Otieno", deliveries: 420, onTime: 398, rating: 4.7, zone: "Athi River" },
  { name: "Patrick Njoroge", deliveries: 310, onTime: 295, rating: 4.5, zone: "Kitengela" },
  { name: "Brian Ochieng", deliveries: 278, onTime: 260, rating: 4.6, zone: "Athi River" },
  { name: "George Mutua", deliveries: 250, onTime: 240, rating: 4.8, zone: "Athi River" },
  { name: "Daniel Kiprop", deliveries: 195, onTime: 190, rating: 4.9, zone: "Nairobi" },
];

const driverColumns: Column<(typeof driverData)[0]>[] = [
  { key: "name", header: "Driver", sortable: true },
  { key: "deliveries", header: "Total Deliveries", sortable: true },
  { key: "onTime", header: "On Time", sortable: true },
  { key: "rating", header: "Rating", sortable: true },
  { key: "zone", header: "Zone", sortable: true },
];

// --- Customer Report Data ---
const customerData = [
  { segment: "New (< 1 month)", count: 85, orders: 95, revenue: 152000, retention: "42%" },
  { segment: "Active (1-6 months)", count: 320, orders: 580, revenue: 1045000, retention: "78%" },
  { segment: "Loyal (6-12 months)", count: 285, orders: 890, revenue: 1602000, retention: "91%" },
  { segment: "VIP (12+ months)", count: 157, orders: 1250, revenue: 2125000, retention: "96%" },
];

const customerColumns: Column<(typeof customerData)[0]>[] = [
  { key: "segment", header: "Segment" },
  { key: "count", header: "Customers", sortable: true },
  { key: "orders", header: "Orders", sortable: true },
  { key: "revenue", header: "Revenue", sortable: true, render: (row) => `KES ${row.revenue.toLocaleString()}` },
  { key: "retention", header: "Retention Rate" },
];

// --- Revenue by Service ---
const revenueByService = [
  { service: "Carpets", revenue: 980000, orders: 420, percentage: 40 },
  { service: "Sofas", revenue: 585000, orders: 280, percentage: 24 },
  { service: "Curtains", revenue: 368000, orders: 195, percentage: 15 },
  { service: "Mattresses", revenue: 245000, orders: 120, percentage: 10 },
  { service: "Rugs", revenue: 172000, orders: 88, percentage: 7 },
  { service: "Chairs", revenue: 100000, orders: 81, percentage: 4 },
];

/**
 * Admin Reports & Analytics Page
 * Tabs for Sales, Revenue, Zones, Drivers, and Customers.
 */
export const ReportsAnalytics = () => {
  const [dateRange, setDateRange] = useState({ start: "2024-01-01", end: "2024-12-31" });

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
            <ExportButton data={salesByMonth} filename="sales-report" />
          </div>
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Monthly Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable data={salesByMonth} columns={salesColumns} searchable={false} pageSize={12} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="flex justify-end">
            <ExportButton data={revenueByService} filename="revenue-report" />
          </div>
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Revenue by Service</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {revenueByService.map((item) => (
                  <div key={item.service} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{item.service}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">{item.orders} orders</span>
                        <span className="font-medium text-foreground w-32 text-right">
                          KES {item.revenue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full bg-primary transition-all"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zones Tab */}
        <TabsContent value="zones" className="space-y-4">
          <div className="flex justify-end">
            <ExportButton data={zoneData} filename="zone-report" />
          </div>
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Zone Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable data={zoneData} columns={zoneColumns} searchable={false} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Drivers Tab */}
        <TabsContent value="drivers" className="space-y-4">
          <div className="flex justify-end">
            <ExportButton data={driverData} filename="driver-report" />
          </div>
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Driver Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable data={driverData} columns={driverColumns} searchable={false} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex justify-end">
            <ExportButton data={customerData} filename="customer-report" />
          </div>
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Customer Segmentation</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable data={customerData} columns={customerColumns} searchable={false} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsAnalytics;
