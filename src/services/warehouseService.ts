import { supabase } from '@/lib/supabase';
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
  };
}

function mapProcessing(row: Record<string, unknown>): ProcessingItem {
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
    startedAt: (row.started_at as string) ?? undefined,
    estimatedCompletion: (row.estimated_completion as string) ?? undefined,
    warehouseLocation: (row.warehouse_location as string) ?? '',
    daysInWarehouse: (row.days_in_warehouse as number) ?? 0,
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

export const getIntakeQueue = async (): Promise<IntakeItem[]> => {
  const { data, error } = await supabase
    .from('warehouse_intake')
    .select('*')
    .order('received_at', { ascending: false });

  if (error || !data) return [];
  return data.map(mapIntake);
};

export const getProcessingItems = async (
  stage?: ProcessingItem['stage'],
): Promise<ProcessingItem[]> => {
  let query = supabase
    .from('warehouse_processing')
    .select('*')
    .order('started_at', { ascending: false });

  if (stage) {
    query = query.eq('stage', stage);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapProcessing);
};

export const getDispatchQueue = async (): Promise<DispatchItem[]> => {
  const { data, error } = await supabase
    .from('warehouse_dispatch')
    .select('*')
    .order('ready_since', { ascending: false });

  if (error || !data) return [];
  return data.map(mapDispatch);
};

export const getWarehouseStats = async (): Promise<WarehouseStats> => {
  const { data, error } = await supabase
    .from('warehouse_stats')
    .select('*')
    .limit(1)
    .single();

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
  const { error } = await supabase
    .from('warehouse_processing')
    .update({ stage: newStage, updated_at: new Date().toISOString() })
    .eq('id', itemId);

  if (error) return { success: false };

  const { data } = await supabase
    .from('warehouse_processing')
    .select('*')
    .eq('id', itemId)
    .single();

  return { success: true, item: data ? mapProcessing(data) : undefined };
};

export const performQualityCheck = async (
  itemId: string,
  passed: boolean,
  notes: string,
  checkedBy: string,
  issues?: string[],
): Promise<{ success: boolean; result?: QualityCheckResult }> => {
  const { data: item } = await supabase
    .from('warehouse_processing')
    .select('order_id')
    .eq('id', itemId)
    .single();

  const { data: result, error } = await supabase
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
    .single();

  if (error || !result) return { success: false };

  if (passed) {
    await supabase
      .from('warehouse_processing')
      .update({ stage: 'ready_for_dispatch', updated_at: new Date().toISOString() })
      .eq('id', itemId);
  }

  return { success: true, result: mapQualityCheck(result) };
};
