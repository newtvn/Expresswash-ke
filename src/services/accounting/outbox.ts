import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';
import type {
  EnqueueNotificationInput,
  NotificationOutboxItem,
} from '@/types/accounting';

function mapOutboxItem(row: Record<string, unknown>): NotificationOutboxItem {
  return {
    id: row.id as string,
    eventType: row.event_type as string,
    aggregateType: row.aggregate_type as string,
    aggregateId: (row.aggregate_id as string) ?? undefined,
    channel: row.channel as NotificationOutboxItem['channel'],
    recipientContact: row.recipient_contact as string,
    recipientName: (row.recipient_name as string) ?? undefined,
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: row.status as NotificationOutboxItem['status'],
    idempotencyKey: row.idempotency_key as string,
    availableAt: row.available_at as string,
    attemptCount: Number(row.attempt_count) || 0,
    maxAttempts: Number(row.max_attempts) || 0,
    lastError: (row.last_error as string) ?? undefined,
    provider: (row.provider as string) ?? undefined,
    providerMessageId: (row.provider_message_id as string) ?? undefined,
    sentAt: (row.sent_at as string) ?? undefined,
    deliveredAt: (row.delivered_at as string) ?? undefined,
    readAt: (row.read_at as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function enqueueNotification(input: EnqueueNotificationInput): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('enqueue_notification_outbox', {
      p_event_type: input.eventType,
      p_aggregate_type: input.aggregateType,
      p_aggregate_id: input.aggregateId ?? null,
      p_channel: input.channel,
      p_recipient_contact: input.recipientContact,
      p_recipient_name: input.recipientName ?? null,
      p_payload: input.payload ?? {},
      p_idempotency_key: input.idempotencyKey,
      p_available_at: input.availableAt ?? null,
    }),
    { maxRetries: 2 },
  );

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Failed to enqueue notification' };
  }

  return { success: true, id: data as string };
}

export async function listNotificationOutbox(status?: NotificationOutboxItem['status']): Promise<NotificationOutboxItem[]> {
  let query = supabase
    .from('notification_outbox')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });

  if (error || !data) return [];
  return data.map(mapOutboxItem);
}

export async function replayNotificationOutbox(id: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('replay_notification_outbox', { p_outbox_id: id }),
    { maxRetries: 2 },
  );

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Failed to replay notification' };
  }

  return { success: true, id: data as string };
}
