import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';
import {
  IntakeItem,
  ProcessingItem,
  DispatchItem,
  WarehouseStats,
  QualityCheckResult,
} from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────

function mapIntake(row: Record<string, unknown>): IntakeItem {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    orderNumber: row.order_number as string,
    customerName: row.customer_name as string,
    itemName: row.item_name as string,
    itemType: row.item_type as string,
    quantity: row.quantity as number,
    conditionNotes: (row.condition_notes as string) ?? '',
    warehouseLocation: (row.warehouse_location as string) ?? undefined,
    receivedAt: row.received_at as string,
    receivedBy: row.received_by as string,
    imageUrl: (row.image_url as string) ?? undefined,
  };
}

function mapProcessing(row: Record<string, unknown>): ProcessingItem {
  const startedAt = (row.started_at as string) ?? undefined;
  // Derive days-in-warehouse from the actual start timestamp instead of the
  // stored (and easily stale) days_in_warehouse column.
  const daysInWarehouse = startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 86_400_000))
    : (row.days_in_warehouse as number) ?? 0;
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    orderNumber: row.order_number as string,
    customerName: row.customer_name as string,
    itemName: row.item_name as string,
    itemType: row.item_type as string,
    quantity: row.quantity as number,
    stage: row.stage as ProcessingItem['stage'],
    assignedTo: (row.assigned_to as string) ?? undefined,
    startedAt,
    estimatedCompletion: (row.estimated_completion as string) ?? undefined,
    warehouseLocation: (row.warehouse_location as string) ?? '',
    daysInWarehouse,
  };
}

function mapDispatch(row: Record<string, unknown>): DispatchItem {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    orderNumber: row.order_number as string,
    customerName: row.customer_name as string,
    zone: (row.zone as string) ?? '',
    items: (row.items as string[]) ?? [],
    totalItems: (row.total_items as number) ?? 0,
    readySince: row.ready_since as string,
    assignedDriver: (row.assigned_driver as string) ?? undefined,
    scheduledDelivery: (row.scheduled_delivery as string) ?? undefined,
  };
}

export interface WarehousePage<T> {
  rows: T[];
  total: number;
}

function mapQualityCheck(row: Record<string, unknown>): QualityCheckResult {
  return {
    id: row.id as string,
    itemId: row.item_id as string,
    orderId: row.order_id as string,
    passed: row.passed as boolean,
    notes: (row.notes as string) ?? '',
    checkedBy: row.checked_by as string,
    checkedAt: row.checked_at as string,
    issues: (row.issues as string[]) ?? undefined,
  };
}

// ── Public API ────────────────────────────────────────────────────────

export const getIntakeQueuePage = async (params: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<WarehousePage<IntakeItem>> => {
  const from = params.page * params.pageSize;
  let query = supabase
    .from('warehouse_intake')
    .select('*', { count: 'exact' })
    .order('received_at', { ascending: false })
    .range(from, from + params.pageSize - 1);
  const term = params.search?.trim();
  if (term) query = query.or(`order_number.ilike.%${term}%,customer_name.ilike.%${term}%,item_name.ilike.%${term}%`);

  const { data, count, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });
  if (error) throw new Error(error.message);
  return { rows: (data ?? []).map(mapIntake), total: count ?? 0 };
};

export const getIntakeQueueStats = async (): Promise<{ total: number; today: number }> => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const countRows = async (todayOnly: boolean) => {
    let query = supabase.from('warehouse_intake').select('id', { count: 'exact', head: true });
    if (todayOnly) query = query.gte('received_at', start.toISOString()).lt('received_at', end.toISOString());
    const { count, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });
    return error ? 0 : (count ?? 0);
  };
  const [total, today] = await Promise.all([countRows(false), countRows(true)]);
  return { total, today };
};

export const getProcessingItemsPage = async (params: {
  page: number;
  pageSize: number;
  stage?: ProcessingItem['stage'];
  search?: string;
}): Promise<WarehousePage<ProcessingItem>> => {
  const from = params.page * params.pageSize;
  let query = supabase
    .from('warehouse_processing')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .range(from, from + params.pageSize - 1);
  if (params.stage) query = query.eq('stage', params.stage);
  const term = params.search?.trim();
  if (term) query = query.or(`order_number.ilike.%${term}%,customer_name.ilike.%${term}%,item_name.ilike.%${term}%`);

  const { data, count, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });
  if (error) throw new Error(error.message);
  return { rows: (data ?? []).map(mapProcessing), total: count ?? 0 };
};

export interface WarehouseDispatchPageRow {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  itemName: string;
  itemType: string;
  quantity: number;
  zone: string;
  assignedDriver: string | null;
  scheduledDelivery: string | null;
  readySince: string;
  dispatchId: string | null;
}

export const getDispatchQueuePage = async (params: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<WarehousePage<WarehouseDispatchPageRow>> => {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_warehouse_dispatch_page', {
      p_offset: params.page * params.pageSize,
      p_limit: params.pageSize,
      p_search: params.search?.trim() || null,
    }),
    { maxRetries: 2 },
  );
  if (error) throw new Error(error.message);
  const result = (data ?? {}) as { rows?: Record<string, unknown>[]; total?: number };
  return {
    rows: (result.rows ?? []).map((row) => ({
      id: String(row.id),
      orderId: String(row.order_id),
      orderNumber: String(row.order_number),
      customerName: String(row.customer_name),
      itemName: String(row.item_name),
      itemType: String(row.item_type ?? ''),
      quantity: Number(row.quantity) || 0,
      zone: String(row.zone ?? ''),
      assignedDriver: row.assigned_driver ? String(row.assigned_driver) : null,
      scheduledDelivery: row.scheduled_delivery ? String(row.scheduled_delivery) : null,
      readySince: String(row.ready_since),
      dispatchId: row.dispatch_id ? String(row.dispatch_id) : null,
    })),
    total: Number(result.total) || 0,
  };
};

export const getDispatchQueueStats = async (): Promise<{
  ready: number;
  awaitingDriver: number;
  dispatched: number;
}> => {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_warehouse_dispatch_stats'),
    { maxRetries: 2 },
  );
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { ready: 0, awaitingDriver: 0, dispatched: 0 };
  return {
    ready: Number(row.ready_count) || 0,
    awaitingDriver: Number(row.awaiting_driver) || 0,
    dispatched: Number(row.dispatched_count) || 0,
  };
};

export const dispatchWarehouseOrder = async (
  orderId: string,
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await supabase.rpc('dispatch_warehouse_order', {
    p_order_id: orderId,
  });

  if (error || data !== true) {
    return { success: false, error: error?.message ?? 'Order was not dispatched' };
  }

  return { success: true };
};

export const getWarehouseStats = async (): Promise<WarehouseStats> => {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.from('warehouse_stats').select('*').limit(1).single(),
    { maxRetries: 2 }
  );

  if (error || !data) {
    return {
      totalItems: 0,
      inWashing: 0,
      inDrying: 0,
      inQualityCheck: 0,
      readyForDispatch: 0,
      overdueItems: 0,
      capacityUsed: 0,
      capacityTotal: 200,
    };
  }

  return {
    totalItems: (data.total_items as number) ?? 0,
    inWashing: (data.in_washing as number) ?? 0,
    inDrying: (data.in_drying as number) ?? 0,
    inQualityCheck: (data.in_quality_check as number) ?? 0,
    readyForDispatch: (data.ready_for_dispatch as number) ?? 0,
    overdueItems: (data.overdue_items as number) ?? 0,
    capacityUsed: (data.capacity_used as number) ?? 0,
    capacityTotal: (data.capacity_total as number) ?? 200,
  };
};

export const updateItemStage = async (
  itemId: string,
  newStage: ProcessingItem['stage'],
): Promise<{ success: boolean; item?: ProcessingItem }> => {
  const { error } = await retrySupabaseQuery(
    () => supabase
      .from('warehouse_processing')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', itemId),
    { maxRetries: 3 }
  );

  if (error) return { success: false };

  const { data } = await retrySupabaseQuery(
    () => supabase.from('warehouse_processing').select('*').eq('id', itemId).single(),
    { maxRetries: 2 }
  );

  return { success: true, item: data ? mapProcessing(data) : undefined };
};

export const performQualityCheck = async (
  itemId: string,
  passed: boolean,
  notes: string,
  checkedBy: string,
  issues?: string[],
): Promise<{ success: boolean; result?: QualityCheckResult }> => {
  const { data: item } = await retrySupabaseQuery(
    () => supabase.from('warehouse_processing').select('order_id').eq('id', itemId).single(),
    { maxRetries: 2 }
  );

  const { data: result, error } = await retrySupabaseQuery(
    () => supabase
      .from('quality_checks')
      .insert({
        item_id: itemId,
        order_id: item?.order_id ?? '',
        passed,
        notes,
        checked_by: checkedBy,
        checked_at: new Date().toISOString(),
        issues: issues ?? null,
      })
      .select()
      .single(),
    { maxRetries: 3 }
  );

  if (error || !result) return { success: false };

  if (passed) {
    await retrySupabaseQuery(
      () => supabase
        .from('warehouse_processing')
        .update({ stage: 'ready_for_dispatch', updated_at: new Date().toISOString() })
        .eq('id', itemId),
      { maxRetries: 3 }
    );
  }

  return { success: true, result: mapQualityCheck(result) };
};
