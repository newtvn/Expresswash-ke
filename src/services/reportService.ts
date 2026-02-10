import { supabase } from '@/lib/supabase';
import {
  KPIData,
  SalesReportData,
  ZonePerformance,
  RevenueByItemType,
  DriverPerformanceData,
  CustomerDemographic,
  ReportFilters,
} from '@/types';

// ── Public API ────────────────────────────────────────────────────────

export const getKPIs = async (): Promise<KPIData[]> => {
  const { data, error } = await supabase
    .from('report_kpis')
    .select('*')
    .order('id', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    label: row.label as string,
    value: row.value as number | string,
    change: row.change as number,
    changeDirection: row.change_direction as KPIData['changeDirection'],
    format: row.format as KPIData['format'],
  }));
};

export const getSalesReport = async (
  _filters?: ReportFilters,
): Promise<SalesReportData[]> => {
  const { data, error } = await supabase
    .from('report_sales')
    .select('*')
    .order('date', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    date: row.date as string,
    orders: row.orders as number,
    revenue: row.revenue as number,
    avgOrderValue: row.avg_order_value as number,
  }));
};

export const getZonePerformance = async (): Promise<ZonePerformance[]> => {
  const { data, error } = await supabase
    .from('report_zone_performance')
    .select('*')
    .order('orders', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    zone: row.zone as string,
    orders: row.orders as number,
    revenue: row.revenue as number,
    avgDeliveryTime: row.avg_delivery_time as number,
    customerSatisfaction: row.customer_satisfaction as number,
    onTimeRate: row.on_time_rate as number,
  }));
};

export const getRevenueByItemType = async (): Promise<RevenueByItemType[]> => {
  const { data, error } = await supabase
    .from('report_revenue_by_item')
    .select('*')
    .order('revenue', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    itemType: row.item_type as string,
    revenue: row.revenue as number,
    orders: row.orders as number,
    avgPrice: row.avg_price as number,
  }));
};

export const getDriverPerformance = async (): Promise<DriverPerformanceData[]> => {
  const { data, error } = await supabase
    .from('report_driver_performance')
    .select('*')
    .order('deliveries', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    driverId: row.driver_id as string,
    name: row.name as string,
    deliveries: row.deliveries as number,
    onTimeRate: row.on_time_rate as number,
    avgRating: row.avg_rating as number,
    fuelCost: row.fuel_cost as number,
  }));
};

export const getCustomerDemographics = async (): Promise<CustomerDemographic[]> => {
  const { data, error } = await supabase
    .from('report_customer_demographics')
    .select('*')
    .order('count', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    segment: row.segment as string,
    count: row.count as number,
    percentage: row.percentage as number,
    avgOrderValue: row.avg_order_value as number,
  }));
};
