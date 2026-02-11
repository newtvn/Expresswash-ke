import { supabase } from '@/lib/supabase';
import { Order, TrackingResponse, PaginatedResponse } from '@/types';

export interface OrderListFilters {
  status?: number;
  zone?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateOrderData {
  customerId: string;
  customerName: string;
  zone: string;
  pickupDate: string;
  pickupAddress: string;
  items: { name: string; quantity: number }[];
  notes?: string;
}

function generateTrackingCode(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(10000 + Math.random() * 90000);
  return `EW-${year}-${num}`;
}

function mapOrder(row: Record<string, unknown>, items: Record<string, unknown>[]): Order {
  return {
    id: row.id as string,
    trackingCode: row.tracking_code as string,
    customerId: (row.customer_id as string) ?? undefined,
    customerName: row.customer_name as string,
    status: row.status as number,
    items: items.map((i) => ({ name: i.name as string, quantity: i.quantity as number })),
    pickupDate: row.pickup_date as string,
    estimatedDelivery: row.estimated_delivery as string,
    zone: row.zone as string,
    driverName: (row.driver_name as string) ?? undefined,
    driverPhone: (row.driver_phone as string) ?? undefined,
    driverId: (row.driver_id as string) ?? undefined,
    pickupAddress: (row.pickup_address as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const createOrder = async (
  data: CreateOrderData,
): Promise<{ success: boolean; order?: Order; error?: string }> => {
  let trackingCode = generateTrackingCode();

  // Ensure unique tracking code
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('tracking_code', trackingCode)
      .maybeSingle();
    if (!existing) break;
    trackingCode = generateTrackingCode();
    attempts++;
  }

  const pickupDate = data.pickupDate;
  const estimatedDelivery = new Date(new Date(pickupDate).getTime() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      tracking_code: trackingCode,
      customer_id: data.customerId,
      customer_name: data.customerName,
      status: 1,
      pickup_date: pickupDate,
      estimated_delivery: estimatedDelivery,
      zone: data.zone,
      pickup_address: data.pickupAddress,
      notes: data.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !order) {
    return { success: false, error: error?.message ?? 'Failed to create order' };
  }

  if (data.items.length > 0) {
    const { error: itemsError } = await supabase.from('order_items').insert(
      data.items.map((item) => ({
        order_id: order.id,
        name: item.name,
        quantity: item.quantity,
      })),
    );
    if (itemsError) {
      // Rollback order if items failed
      await supabase.from('orders').delete().eq('id', order.id);
      return { success: false, error: 'Failed to save order items' };
    }
  }

  // Update customer profile stats
  await supabase.rpc('increment_customer_orders', { customer_id: data.customerId }).catch(() => null);

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order.id);

  return { success: true, order: mapOrder(order, items ?? []) };
};

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

export const getCustomerOrders = async (
  customerId: string,
  filters: Omit<OrderListFilters, 'page' | 'limit'> & { page?: number; limit?: number } = {},
): Promise<PaginatedResponse<Order>> => {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;
  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('customer_id', customerId);

  if (filters.status !== undefined) query = query.eq('status', filters.status);
  if (filters.search) {
    query = query.or(`tracking_code.ilike.%${filters.search}%`);
  }

  const start = (page - 1) * limit;
  query = query.range(start, start + limit - 1).order('created_at', { ascending: false });

  const { data: orders, count, error } = await query;
  if (error || !orders) {
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }

  const orderIds = orders.map((o) => o.id);
  const { data: allItems } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orderIds);

  const itemsByOrder = (allItems ?? []).reduce<Record<string, Record<string, unknown>[]>>(
    (acc, item) => {
      const oid = item.order_id as string;
      if (!acc[oid]) acc[oid] = [];
      acc[oid].push(item);
      return acc;
    },
    {},
  );

  return {
    data: orders.map((o) => mapOrder(o, itemsByOrder[o.id] ?? [])),
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
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

export const getOrderByUUID = async (orderId: string): Promise<Order | null> => {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order) return null;
  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
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

export const bulkUpdateOrderStatus = async (
  orderIds: string[],
  newStatus: number,
): Promise<{ success: boolean; updated: number }> => {
  const { error, count } = await supabase
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .in('id', orderIds);

  if (error) return { success: false, updated: 0 };
  return { success: true, updated: count ?? orderIds.length };
};

export const assignDriverToOrder = async (
  orderId: string,
  driverId: string,
  driverName: string,
  driverPhone: string,
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('orders')
    .update({
      driver_id: driverId,
      driver_name: driverName,
      driver_phone: driverPhone,
      status: 2,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) return { success: false, error: error.message };
  return { success: true };
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

export const getOrderStats = async (): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  delivered: number;
  cancelled: number;
  byStatus: Record<number, number>;
}> => {
  const { data, error } = await supabase.from('orders').select('status');
  if (error || !data) {
    return { total: 0, pending: 0, inProgress: 0, delivered: 0, cancelled: 0, byStatus: {} };
  }

  const byStatus: Record<number, number> = {};
  data.forEach((o) => {
    const s = o.status as number;
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  });

  return {
    total: data.length,
    pending: byStatus[1] ?? 0,
    inProgress: Object.entries(byStatus)
      .filter(([k]) => Number(k) >= 2 && Number(k) <= 11)
      .reduce((sum, [, v]) => sum + v, 0),
    delivered: byStatus[12] ?? 0,
    cancelled: byStatus[0] ?? 0,
    byStatus,
  };
};
