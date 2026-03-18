import { supabase } from '@/lib/supabase';

// ── Interfaces ───────────────────────────────────────────────────────

export interface DashboardKPIs {
  totalRevenue: number;
  revenueToday: number;
  revenueThisMonth: number;
  ordersToday: number;
  ordersPending: number;
  ordersInProgress: number;
  totalCustomers: number;
  activeDrivers: number;
  avgRating: number;
  unpaidInvoices: number;
  outstandingAmount: number;
  slaBreachesToday: number;
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

export interface RevenueReportData {
  summary: { total_revenue: number; total_payments: number; avg_payment: number };
  by_period: { period: string; payments: number; revenue: number }[];
  by_payment_method: { method: string; count: number; revenue: number }[];
  by_zone: { zone: string; orders: number; revenue: number }[];
}

export interface OrderReportData {
  totals: { total_orders: number; completed: number; cancelled: number; in_progress: number };
  status_breakdown: { status: number; status_name: string; count: number }[];
  daily_orders: { date: string; orders: number; completed: number; cancelled: number }[];
  sla_compliance: { total_with_sla: number; met_sla: number; breached_sla: number };
}

export interface DriverPerformanceRow {
  driver_id: string;
  name: string;
  deliveries: number;
  pickups: number;
  avg_rating: number;
  cash_collected: number;
  cancellation_rate: number;
  total_orders: number;
}

export interface CustomerReportData {
  total_customers: number;
  new_customers_period: number;
  tier_distribution: { tier: string; count: number }[];
  top_customers: { name: string; order_count: number; total_spent: number }[];
  zone_distribution: { zone: string; count: number }[];
  avg_review_rating: number;
}

export interface FinancialReportData {
  total_revenue: number;
  total_expenses: number;
  gross_profit: number;
  profit_margin: number;
  expenses_by_category: { category: string; total: number; count: number }[];
  outstanding_receivables: number;
  overdue_count: number;
}

// ── Dashboard KPIs (enhanced JSONB version) ──────────────────────────

export const getDashboardKPIs = async (): Promise<DashboardKPIs> => {
  const { data, error } = await supabase.rpc('get_dashboard_kpis');

  if (error || !data) {
    return {
      totalRevenue: 0,
      revenueToday: 0,
      revenueThisMonth: 0,
      ordersToday: 0,
      ordersPending: 0,
      ordersInProgress: 0,
      totalCustomers: 0,
      activeDrivers: 0,
      avgRating: 0,
      unpaidInvoices: 0,
      outstandingAmount: 0,
      slaBreachesToday: 0,
    };
  }

  // The new function returns JSONB directly
  const d = typeof data === 'string' ? JSON.parse(data) : data;

  return {
    totalRevenue: Number(d.total_revenue) || 0,
    revenueToday: Number(d.revenue_today) || 0,
    revenueThisMonth: Number(d.revenue_this_month) || 0,
    ordersToday: Number(d.orders_today) || 0,
    ordersPending: Number(d.orders_pending) || 0,
    ordersInProgress: Number(d.orders_in_progress) || 0,
    totalCustomers: Number(d.total_customers) || 0,
    activeDrivers: Number(d.active_drivers) || 0,
    avgRating: Number(d.avg_rating) || 0,
    unpaidInvoices: Number(d.unpaid_invoices) || 0,
    outstandingAmount: Number(d.outstanding_amount) || 0,
    slaBreachesToday: Number(d.sla_breaches_today) || 0,
  };
};

// ── Existing functions (kept) ────────────────────────────────────────

export const getOrderStatusCounts = async (): Promise<OrderStatusCount[]> => {
  const { data, error } = await supabase.rpc('get_order_status_counts');
  if (error || !data) return [];
  return data.map((row: { status_name: string; count: number }) => ({
    status: row.status_name,
    count: Number(row.count),
  }));
};

export const getSalesData = async (days = 30): Promise<SalesDataPoint[]> => {
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

  const { data, error } = await supabase.rpc('get_sales_by_date', { days_back: days });
  if (error || !data || data.length === 0) return [];

  return data.map((row: { date: string; orders: number; revenue: number; avg_order_value: number }) => ({
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

// ── New report RPC functions ─────────────────────────────────────────

export const getRevenueReport = async (
  startDate: string,
  endDate: string,
  granularity: 'day' | 'week' | 'month' = 'day',
): Promise<RevenueReportData> => {
  const { data, error } = await supabase.rpc('get_revenue_report', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_granularity: granularity,
  });

  if (error || !data) {
    return {
      summary: { total_revenue: 0, total_payments: 0, avg_payment: 0 },
      by_period: [],
      by_payment_method: [],
      by_zone: [],
    };
  }

  const d = typeof data === 'string' ? JSON.parse(data) : data;
  return d as RevenueReportData;
};

export const getOrderReport = async (
  startDate: string,
  endDate: string,
): Promise<OrderReportData> => {
  const { data, error } = await supabase.rpc('get_order_report', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error || !data) {
    return {
      totals: { total_orders: 0, completed: 0, cancelled: 0, in_progress: 0 },
      status_breakdown: [],
      daily_orders: [],
      sla_compliance: { total_with_sla: 0, met_sla: 0, breached_sla: 0 },
    };
  }

  const d = typeof data === 'string' ? JSON.parse(data) : data;
  return d as OrderReportData;
};

export const getDriverPerformanceReport = async (
  startDate: string,
  endDate: string,
): Promise<DriverPerformanceRow[]> => {
  const { data, error } = await supabase.rpc('get_driver_performance_report', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error || !data) return [];
  const d = typeof data === 'string' ? JSON.parse(data) : data;
  return d as DriverPerformanceRow[];
};

export const getCustomerReport = async (
  startDate: string,
  endDate: string,
): Promise<CustomerReportData> => {
  const { data, error } = await supabase.rpc('get_customer_report', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error || !data) {
    return {
      total_customers: 0,
      new_customers_period: 0,
      tier_distribution: [],
      top_customers: [],
      zone_distribution: [],
      avg_review_rating: 0,
    };
  }

  const d = typeof data === 'string' ? JSON.parse(data) : data;
  return d as CustomerReportData;
};

export const getFinancialReport = async (
  startDate: string,
  endDate: string,
): Promise<FinancialReportData> => {
  const { data, error } = await supabase.rpc('get_financial_report', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error || !data) {
    return {
      total_revenue: 0,
      total_expenses: 0,
      gross_profit: 0,
      profit_margin: 0,
      expenses_by_category: [],
      outstanding_receivables: 0,
      overdue_count: 0,
    };
  }

  const d = typeof data === 'string' ? JSON.parse(data) : data;
  return d as FinancialReportData;
};
