import { supabase } from '@/lib/supabase';
import { Order, TrackingResponse, PaginatedResponse } from '@/types';

export interface OrderListFilters {
  status?: number;
  zone?: string;
  search?: string;
  page: number;
  limit: number;
}

function mapOrder(row: Record<string, unknown>, items: Record<string, unknown>[]): Order {
  return {
    trackingCode: row.tracking_code as string,
    customerName: row.customer_name as string,
    status: row.status as number,
    items: items.map((i) => ({ name: i.name as string, quantity: i.quantity as number })),
    pickupDate: row.pickup_date as string,
    estimatedDelivery: row.estimated_delivery as string,
    zone: row.zone as string,
    driverName: (row.driver_name as string) ?? undefined,
    driverPhone: (row.driver_phone as string) ?? undefined,
  };
}

export const trackOrder = async (trackingCode: string): Promise<TrackingResponse> => {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .ilike('tracking_code', trackingCode)
    .single();

  if (error || !order) {
    return { success: false, error: 'Order not found. Please check your tracking code.' };
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order.id);

  return { success: true, order: mapOrder(order, items ?? []) };
};

export const getOrders = async (
  filters: OrderListFilters = { page: 1, limit: 10 },
): Promise<PaginatedResponse<Order>> => {
  let query = supabase.from('orders').select('*', { count: 'exact' });

  if (filters.status !== undefined) {
    query = query.eq('status', filters.status);
  }
  if (filters.zone) {
    query = query.ilike('zone', filters.zone);
  }
  if (filters.search) {
    query = query.or(
      `tracking_code.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,zone.ilike.%${filters.search}%`,
    );
  }

  const start = (filters.page - 1) * filters.limit;
  query = query.range(start, start + filters.limit - 1).order('created_at', { ascending: false });

  const { data: orders, count, error } = await query;

  if (error || !orders) {
    return { data: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0 };
  }

  const orderIds = orders.map((o) => o.id);
  const { data: allItems } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orderIds);

  const itemsByOrder = (allItems ?? []).reduce<Record<string, Record<string, unknown>[]>>((acc, item) => {
    const oid = item.order_id as string;
    if (!acc[oid]) acc[oid] = [];
    acc[oid].push(item);
    return acc;
  }, {});

  const data = orders.map((o) => mapOrder(o, itemsByOrder[o.id] ?? []));
  const total = count ?? 0;

  return {
    data,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
};

export const getOrderById = async (trackingCode: string): Promise<Order | null> => {
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .ilike('tracking_code', trackingCode)
    .single();

  if (!order) return null;

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order.id);

  return mapOrder(order, items ?? []);
};

export const updateOrderStatus = async (
  trackingCode: string,
  newStatus: number,
): Promise<{ success: boolean; order?: Order }> => {
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .ilike('tracking_code', trackingCode)
    .single();

  if (!existing) return { success: false };

  const { error } = await supabase
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', existing.id);

  if (error) return { success: false };

  const order = await getOrderById(trackingCode);
  return { success: true, order: order ?? undefined };
};

export const cancelOrder = async (
  trackingCode: string,
): Promise<{ success: boolean; message: string }> => {
  const order = await getOrderById(trackingCode);
  if (!order) {
    return { success: false, message: 'Order not found' };
  }
  if (order.status >= 6) {
    return { success: false, message: 'Cannot cancel order that is already being delivered' };
  }

  const { error } = await supabase
    .from('orders')
    .update({ status: 0, updated_at: new Date().toISOString() })
    .ilike('tracking_code', trackingCode);

  if (error) return { success: false, message: 'Failed to cancel order' };
  return { success: true, message: 'Order cancelled successfully' };
};
