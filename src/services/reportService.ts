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
  const [ordersResult, customersResult, revenueResult] = await Promise.all([
    supabase.from('orders').select('status', { count: 'exact' }),
    supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'customer'),
    supabase.from('payments').select('amount').eq('status', 'completed'),
  ]);

  const orders = ordersResult.data ?? [];
  const activeOrders = orders.filter((o) => {
    const s = o.status as number;
    return s >= 1 && s <= 11;
  }).length;

  const totalRevenue = (revenueResult.data ?? []).reduce(
    (sum, p) => sum + (p.amount as number),
    0,
  );

  return {
    totalRevenue,
    totalRevenueChange: 0,
    activeOrders,
    activeOrdersChange: 0,
    totalCustomers: customersResult.count ?? 0,
    totalCustomersChange: 0,
    avgRating: 4.7,
  };
};

export const getOrderStatusCounts = async (): Promise<OrderStatusCount[]> => {
  const { data, error } = await supabase.from('orders').select('status');
  if (error || !data) return [];

  const statusNames: Record<number, string> = {
    0: 'Cancelled',
    1: 'Pending',
    2: 'Driver Assigned',
    3: 'Quote Accepted',
    4: 'Pickup Scheduled',
    5: 'Picked Up',
    6: 'In Washing',
    7: 'Drying',
    8: 'Quality Check',
    9: 'Ready',
    10: 'Dispatched',
    11: 'Out for Delivery',
    12: 'Delivered',
  };

  const counts: Record<number, number> = {};
  data.forEach((o) => {
    const s = o.status as number;
    counts[s] = (counts[s] ?? 0) + 1;
  });

  return Object.entries(counts).map(([status, count]) => ({
    status: statusNames[Number(status)] ?? `Status ${status}`,
    count,
  }));
};

export const getSalesData = async (days = 30): Promise<SalesDataPoint[]> => {
  const { data, error } = await supabase.from('report_sales').select('*').order('date');
  if (error || !data || data.length === 0) {
    // Generate from orders if no report data
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders } = await supabase
      .from('orders')
      .select('created_at, status')
      .gte('created_at', since)
      .order('created_at');

    if (!orders || orders.length === 0) return [];

    const byDay: Record<string, number> = {};
    orders.forEach((o) => {
      const day = (o.created_at as string).split('T')[0];
      byDay[day] = (byDay[day] ?? 0) + 1;
    });

    return Object.entries(byDay).map(([date, count]) => ({
      date,
      orders: count,
      revenue: count * 2500,
      avgOrderValue: 2500,
    }));
  }

  return data.map((row) => ({
    date: row.date as string,
    orders: row.orders as number,
    revenue: row.revenue as number,
    avgOrderValue: row.avg_order_value as number,
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
