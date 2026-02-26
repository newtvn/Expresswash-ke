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
  const [kpiResult, ratingResult] = await Promise.all([
    supabase.rpc('get_dashboard_kpis').single(),
    supabase
      .from('reviews')
      .select('overall_rating')
      .eq('status', 'approved'),
  ]);

  // Calculate average rating from approved reviews
  let avgRating = 0;
  if (!ratingResult.error && ratingResult.data && ratingResult.data.length > 0) {
    const sum = ratingResult.data.reduce(
      (acc, r) => acc + ((r.overall_rating as number) ?? 0),
      0,
    );
    avgRating = Math.round((sum / ratingResult.data.length) * 10) / 10;
  }

  if (kpiResult.error || !kpiResult.data) {
    return {
      totalRevenue: 0,
      totalRevenueChange: 0,
      activeOrders: 0,
      activeOrdersChange: 0,
      totalCustomers: 0,
      totalCustomersChange: 0,
      avgRating,
    };
  }

  return {
    totalRevenue: Number(kpiResult.data.total_revenue) || 0,
    totalRevenueChange: 0,
    activeOrders: Number(kpiResult.data.active_orders) || 0,
    activeOrdersChange: 0,
    totalCustomers: Number(kpiResult.data.total_customers) || 0,
    totalCustomersChange: 0,
    avgRating,
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
