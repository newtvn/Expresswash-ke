export interface SalesReportData {
  date: string;
  orders: number;
  revenue: number;
  avgOrderValue: number;
}

export interface ZonePerformance {
  zone: string;
  orders: number;
  revenue: number;
  avgDeliveryTime: number;
  customerSatisfaction: number;
  onTimeRate: number;
}

export interface ReportFilters {
  startDate: string;
  endDate: string;
  zone?: string;
  groupBy: 'day' | 'week' | 'month';
}

export interface KPIData {
  label: string;
  value: number | string;
  change: number;
  changeDirection: 'up' | 'down' | 'flat';
  format: 'number' | 'currency' | 'percentage';
}

export interface CustomerDemographic {
  segment: string;
  count: number;
  percentage: number;
  avgOrderValue: number;
}

export interface DriverPerformanceData {
  driverId: string;
  name: string;
  deliveries: number;
  onTimeRate: number;
  avgRating: number;
  fuelCost: number;
}

export interface RevenueByItemType {
  itemType: string;
  revenue: number;
  orders: number;
  avgPrice: number;
}
