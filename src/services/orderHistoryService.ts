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
  const { data, error } = await supabase
    .from('order_status_history')
    .select(`
      id,
      order_id,
      from_status,
      to_status,
      notes,
      created_at,
      profiles:changed_by ( name )
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedByName: (row.profiles as { name: string } | null)?.name ?? 'System',
    notes: row.notes,
    createdAt: row.created_at,
  }));
}
