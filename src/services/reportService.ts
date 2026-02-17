import { supabase } from '@/lib/supabase';

export interface DashboardKPIs {
  totalRevenue: number;
  totalRevenueChange: number;
  activeOrders: number;
  activeOrdersChange: number;
  totalCustomers: number;
  totalCustomersChange: number;
  avgRating: number;
}

export interface SalesDataPoint {
  date: string;
  orders: number;
  revenue: number;
  avgOrderValue: number;
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

export const getDashboardKPIs = async (): Promise<DashboardKPIs> => {
  // Use database function for server-side aggregation (much faster!)
  const { data, error } = await supabase.rpc('get_dashboard_kpis').single();

  if (error || !data) {
    // Fallback to default values if function fails
    return {
      totalRevenue: 0,
      totalRevenueChange: 0,
      activeOrders: 0,
      activeOrdersChange: 0,
      totalCustomers: 0,
      totalCustomersChange: 0,
      avgRating: 4.7,
    };
  }

  return {
    totalRevenue: Number(data.total_revenue) || 0,
    totalRevenueChange: 0, // TODO: Implement historical comparison
    activeOrders: Number(data.active_orders) || 0,
    activeOrdersChange: 0, // TODO: Implement historical comparison
    totalCustomers: Number(data.total_customers) || 0,
    totalCustomersChange: 0, // TODO: Implement historical comparison
    avgRating: 4.7, // TODO: Fetch from reviews table
  };
};

export const getOrderStatusCounts = async (): Promise<OrderStatusCount[]> => {
  // Use database function for server-side aggregation with status names
  const { data, error } = await supabase.rpc('get_order_status_counts');

  if (error || !data) return [];

  return data.map((row) => ({
    status: row.status_name,
    count: Number(row.count),
  }));
};

export const getSalesData = async (days = 30): Promise<SalesDataPoint[]> => {
  // First check for materialized report data
  const { data: reportData, error: reportError } = await supabase
    .from('report_sales')
    .select('*')
    .order('date');

  if (!reportError && reportData && reportData.length > 0) {
    return reportData.map((row) => ({
      date: row.date as string,
      orders: row.orders as number,
      revenue: row.revenue as number,
      avgOrderValue: row.avg_order_value as number,
    }));
  }

  // Fallback to database function for real-time aggregation
  const { data, error } = await supabase.rpc('get_sales_by_date', { days_back: days });

  if (error || !data || data.length === 0) return [];

  return data.map((row) => ({
    date: row.date,
    orders: Number(row.orders),
    revenue: Number(row.revenue),
    avgOrderValue: Number(row.avg_order_value),
  }));
};

export const getZonePerformance = async () => {
  const { data, error } = await supabase.from('report_zone_performance').select('*');
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
