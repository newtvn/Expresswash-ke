import { supabase } from '@/lib/supabase';
import { Order, OrderItem, TrackingResponse, PaginatedResponse } from '@/types';
import { retrySupabaseQuery } from '@/lib/retryUtils';
import { orderLogger } from '@/lib/logger';
import { getHolidayDates } from './holidayService';

export interface OrderListFilters {
  status?: number;
  zone?: string;
  search?: string;
  customerId?: string;
  page: number;
  limit: number;
}

export interface PickupRequestItem {
  name: string;
  itemType: string;
  quantity: number;
  lengthInches: number;
  widthInches: number;
  pricePerSqInch: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CreateOrderPayload {
  customerId: string;
  customerName: string;
  zone: string;
  pickupAddress: string;
  pickupDate: string;
  items: PickupRequestItem[];
  subtotal: number;
  deliveryFee: number;
  vat: number;
  total: number;
  notes?: string;
}

// Generate a unique tracking code
function generateTrackingCode(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `EW-${year}-${random}`;
}

function mapOrder(row: Record<string, unknown>, items: Record<string, unknown>[]): Order {
  return {
    id: row.id as string,
    trackingCode: row.tracking_code as string,
    customerId: (row.customer_id as string) ?? undefined,
    customerName: row.customer_name as string,
    status: row.status as number,
    items: items.map((i) => ({
      name: i.name as string,
      quantity: i.quantity as number,
      itemType: (i.item_type as string) ?? undefined,
      lengthInches: (i.length_inches as number) ?? undefined,
      widthInches: (i.width_inches as number) ?? undefined,
      unitPrice: (i.unit_price as number) ?? undefined,
      totalPrice: (i.total_price as number) ?? undefined,
    })),
    pickupDate: row.pickup_date as string,
    estimatedDelivery: row.estimated_delivery as string,
    zone: row.zone as string,
    pickupAddress: (row.pickup_address as string) ?? undefined,
    subtotal: (row.subtotal as number) ?? undefined,
    deliveryFee: (row.delivery_fee as number) ?? undefined,
    vat: (row.vat as number) ?? undefined,
    total: (row.total as number) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    driverName: (row.driver_name as string) ?? undefined,
    driverPhone: (row.driver_phone as string) ?? undefined,
    driverId: (row.driver_id as string) ?? undefined,
    createdAt: (row.created_at as string) ?? undefined,
    updatedAt: (row.updated_at as string) ?? undefined,
  };
}

// Calculate ETA based on zone with business day logic
// Rules:
// - Kitengela/Athi River: Same day delivery (if ordered early) or next business day
// - Greater Nairobi (Westlands, etc.): 2 business days (48 hours, skip weekends and holidays)
// - Deliveries only Monday to Friday (excluding holidays)
// - Example: Order Monday in Nairobi → Delivered Wednesday (if no holidays)
export async function calculateETA(zone: string): Promise<{ label: string; date: string }> {
  const now = new Date();
  const z = zone.toLowerCase();

  let businessDaysToAdd = 0;
  let label = '';

  // Determine business days based on zone
  if (z.includes('kitengela') || z.includes('athi river')) {
    businessDaysToAdd = 0; // Same day / Next business day
    label = 'Same Day / Next Business Day';
  } else if (z.includes('syokimau')) {
    businessDaysToAdd = 1; // 1 business day
    label = '1 Business Day';
  } else if (z.includes('nairobi') || z.includes('westlands') || z.includes('karen') ||
             z.includes('ngong') || z.includes('langata')) {
    businessDaysToAdd = 2; // 2 business days (48 hours)
    label = '2 Business Days (48 hours)';
  } else {
    // Other zones - 3 business days
    businessDaysToAdd = 3;
    label = '3 Business Days';
  }

  // Fetch holidays within the next 30 days with error handling
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 30);
  const holidays = await getHolidayDates(
    now.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  ).catch(err => {
    orderLogger.warn('Failed to fetch holidays for ETA calculation', err);
    return []; // Continue without holidays if fetch fails
  });
  const holidaySet = new Set(holidays.map(h => h.toISOString().split('T')[0]));

  // Helper function to check if a date is a holiday
  const isHoliday = (date: Date): boolean => {
    return holidaySet.has(date.toISOString().split('T')[0]);
  };

  // Helper function to check if a date is a business day (Mon-Fri, not holiday)
  const isBusinessDay = (date: Date): boolean => {
    return date.getDay() !== 0 && date.getDay() !== 6 && !isHoliday(date);
  };

  // Calculate delivery date, adding only business days (Mon-Fri, excluding holidays)
  const eta = new Date(now);
  let addedDays = 0;

  while (addedDays < businessDaysToAdd) {
    eta.setDate(eta.getDate() + 1);

    // Skip weekends and holidays
    if (isBusinessDay(eta)) {
      addedDays++;
    }
  }

  // If same day delivery but it's already late, weekend, or holiday, move to next business day
  if (businessDaysToAdd === 0) {
    const currentHour = now.getHours();
    // If it's past 2 PM or it's not a business day, move to next business day
    if (currentHour >= 14 || !isBusinessDay(eta)) {
      let safety = 0;
      while (!isBusinessDay(eta) && safety++ < 365) {
        eta.setDate(eta.getDate() + 1);
      }
      // Move to next business day
      eta.setDate(eta.getDate() + 1);
      safety = 0;
      while (!isBusinessDay(eta) && safety++ < 365) {
        eta.setDate(eta.getDate() + 1);
      }
    }
  }

  // Final check: ensure delivery is on a business day (with safety limit)
  let safety = 0;
  while (!isBusinessDay(eta) && safety++ < 365) {
    eta.setDate(eta.getDate() + 1);
  }

  return { label, date: eta.toISOString().split('T')[0] };
}

// Pricing constants
export const PRICING = {
  pricePerSqInch: {
    carpet: 0.35,
    rug: 0.40,
    curtain: 0.30,
    sofa: 0.50,
    mattress: 0.25,
    chair: 0.45,
    pillow: 0.20,
    other: 0.35,
  } as Record<string, number>,
  deliveryFees: {
    kitengela: 300,
    'athi river': 300,
    syokimau: 350,
    nairobi: 500,
    other: 600,
  } as Record<string, number>,
  vatRate: 0.16,
  minimumOrder: 500,
};

export function getDeliveryFee(zone: string): number {
  const z = zone.toLowerCase();
  for (const [key, fee] of Object.entries(PRICING.deliveryFees)) {
    if (z.includes(key)) return fee;
  }
  return PRICING.deliveryFees.other;
}

export function getPricePerSqInch(itemType: string): number {
  const t = itemType.toLowerCase();
  return PRICING.pricePerSqInch[t] ?? PRICING.pricePerSqInch.other;
}

export function calculateItemPrice(
  itemType: string,
  lengthInches: number,
  widthInches: number,
  quantity: number,
): { sqInches: number; pricePerSqInch: number; unitPrice: number; totalPrice: number } {
  const sqInches = lengthInches * widthInches;
  const pricePerSqInch = getPricePerSqInch(itemType);
  const unitPrice = Math.round(sqInches * pricePerSqInch);
  const totalPrice = unitPrice * quantity;
  return { sqInches, pricePerSqInch, unitPrice, totalPrice };
}

export const createOrder = async (
  payload: CreateOrderPayload,
): Promise<{ success: boolean; order?: Order; error?: string }> => {
  try {
    orderLogger.info('Creating new order', {
      customerId: payload.customerId,
      zone: payload.zone,
      itemCount: payload.items.length,
      total: payload.total,
    });

    let trackingCode = generateTrackingCode();

    // Ensure unique tracking code with retry logic
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing, error } = await retrySupabaseQuery(
        () => supabase
          .from('orders')
          .select('id')
          .eq('tracking_code', trackingCode)
          .maybeSingle(),
        { maxRetries: 2 }
      );

      if (error) {
        orderLogger.error('Failed to check tracking code uniqueness', error);
        throw error;
      }

      if (!existing) break;
      trackingCode = generateTrackingCode();
      attempts++;
    }

    if (attempts >= 5) {
      orderLogger.warn('Failed to generate unique tracking code after 5 attempts');
      return { success: false, error: 'Failed to generate unique tracking code' };
    }

    const eta = await calculateETA(payload.zone);

    const { data: inserted, error } = await retrySupabaseQuery(
      () => supabase
        .from('orders')
        .insert({
          tracking_code: trackingCode,
          customer_id: payload.customerId,
          customer_name: payload.customerName,
          status: 1, // pending
          pickup_date: payload.pickupDate,
          estimated_delivery: eta.date,
          zone: payload.zone,
          pickup_address: payload.pickupAddress,
          subtotal: payload.subtotal,
          delivery_fee: payload.deliveryFee,
          vat: payload.vat,
          total: payload.total,
          notes: payload.notes ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single(),
      { maxRetries: 3 }
    );

    if (error || !inserted) {
      orderLogger.error('Failed to create order', error || new Error('No data returned'));
      return { success: false, error: error?.message ?? 'Failed to create order' };
    }

    // Insert order items with dimensions
    if (payload.items.length > 0) {
      const { error: itemsError } = await retrySupabaseQuery(
        () => supabase.from('order_items').insert(
          payload.items.map((item) => ({
            order_id: inserted.id,
            name: item.name,
            quantity: item.quantity,
            item_type: item.itemType,
            length_inches: item.lengthInches,
            width_inches: item.widthInches,
            unit_price: item.unitPrice,
            total_price: item.totalPrice,
          })),
        ),
        { maxRetries: 3 }
      );

      if (itemsError) {
        orderLogger.error('Failed to save order items, rolling back order', itemsError);
        // Rollback order if items failed
        await supabase.from('orders').delete().eq('id', inserted.id);
        return { success: false, error: 'Failed to save order items' };
      }
    }

    // Update customer profile stats (non-critical, ignore errors)
    await supabase.rpc('increment_customer_orders', { customer_id: payload.customerId }).catch((err) => {
      orderLogger.warn('Failed to increment customer order count', { error: err.message });
    });

    const order = await getOrderById(trackingCode);

    orderLogger.info('Order created successfully', {
      trackingCode,
      orderId: inserted.id,
      total: payload.total,
    });

    return { success: true, order: order ?? undefined };
  } catch (error) {
    orderLogger.error('Unexpected error creating order', error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'An unexpected error occurred while creating your order' };
  }
};

export const trackOrder = async (trackingCode: string): Promise<TrackingResponse> => {
  try {
    orderLogger.info('Tracking order', { trackingCode });

    const { data: order, error } = await retrySupabaseQuery(
      () => supabase
        .from('orders')
        .select('*')
        .ilike('tracking_code', trackingCode)
        .single(),
      { maxRetries: 2 }
    );

    if (error || !order) {
      orderLogger.warn('Order not found', { trackingCode, error: error?.message });
      return { success: false, error: 'Order not found. Please check your tracking code.' };
    }

    const { data: items } = await retrySupabaseQuery(
      () => supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id),
      { maxRetries: 2 }
    );

    orderLogger.info('Order tracked successfully', { trackingCode, orderId: order.id });
    return { success: true, order: mapOrder(order, items ?? []) };
  } catch (error) {
    orderLogger.error('Error tracking order', error instanceof Error ? error : new Error(String(error)), { trackingCode });
    return { success: false, error: 'Unable to track order at this time. Please try again later.' };
  }
};

/**
 * Update order items with actual measured dimensions
 * Called by drivers after measuring items during pickup
 */
export const updateOrderItems = async (
  orderId: string,
  items: Array<{
    name: string;
    quantity: number;
    itemType?: string;
    lengthInches: number;
    widthInches: number;
    unitPrice: number;
    totalPrice: number;
  }>,
  newSubtotal: number,
  newTotal: number,
): Promise<{ success: boolean; error?: string }> => {
  try {
    orderLogger.info('Updating order items with measured dimensions', { orderId, itemCount: items.length });

    // Delete existing items
    const { error: deleteError } = await retrySupabaseQuery(
      () => supabase.from('order_items').delete().eq('order_id', orderId),
      { maxRetries: 2 }
    );

    if (deleteError) {
      orderLogger.error('Failed to delete old order items', deleteError);
      return { success: false, error: 'Failed to update measurements' };
    }

    // Insert updated items
    const itemsToInsert = items.map((item) => ({
      order_id: orderId,
      name: item.name,
      quantity: item.quantity,
      item_type: item.itemType,
      length_inches: item.lengthInches,
      width_inches: item.widthInches,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
    }));

    const { error: insertError } = await retrySupabaseQuery(
      () => supabase.from('order_items').insert(itemsToInsert),
      { maxRetries: 3 }
    );

    if (insertError) {
      orderLogger.error('Failed to insert updated order items', insertError);
      return { success: false, error: 'Failed to save measurements' };
    }

    // Update order totals
    const { error: updateError } = await retrySupabaseQuery(
      () => supabase
        .from('orders')
        .update({
          subtotal: newSubtotal,
          total: newTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId),
      { maxRetries: 2 }
    );

    if (updateError) {
      orderLogger.error('Failed to update order totals', updateError);
      return { success: false, error: 'Failed to update order total' };
    }

    orderLogger.info('Order items updated successfully', { orderId, newSubtotal, newTotal });
    return { success: true };
  } catch (error) {
    orderLogger.error('Unexpected error updating order items', error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'An unexpected error occurred' };
  }
};

export const getOrders = async (
  filters: OrderListFilters = { page: 1, limit: 10 },
): Promise<PaginatedResponse<Order>> => {
  let query = supabase.from('orders').select('*', { count: 'exact' });

  if (filters.status !== undefined) {
    query = query.eq('status', filters.status);
  }
  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId);
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

export const getOrdersByCustomer = async (
  customerId: string,
  filters: Omit<OrderListFilters, 'customerId'> = { page: 1, limit: 20 },
): Promise<PaginatedResponse<Order>> => {
  return getOrders({ ...filters, customerId });
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
