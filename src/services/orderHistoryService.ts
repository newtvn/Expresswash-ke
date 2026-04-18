import { supabase } from '@/lib/supabase';

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  fromStatus: number | null;
  toStatus: number;
  changedByName: string;
  notes: string | null;
  createdAt: string;
}

export async function getOrderStatusHistory(
  orderId: string,
): Promise<OrderStatusHistoryEntry[]> {
  // Fetch history without the FK join (changed_by FK points to auth.users, not profiles,
  // which causes PostgREST to fail resolving the indirect relationship)
  const { data, error } = await supabase
    .from('order_status_history')
    .select('id, order_id, from_status, to_status, notes, created_at, changed_by')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  // Batch-lookup profile names for non-null changed_by values
  const userIds = [...new Set(
    data.map((row) => row.changed_by as string | null).filter(Boolean) as string[]
  )];

  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);

    if (profiles) {
      nameMap = Object.fromEntries(profiles.map((p) => [p.id, p.name as string]));
    }
  }

  return data.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedByName: (row.changed_by && nameMap[row.changed_by]) || 'System',
    notes: row.notes,
    createdAt: row.created_at,
  }));
}
