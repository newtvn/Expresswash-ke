import { supabase } from '@/lib/supabase';

export interface NotificationStats {
  totalSent: number;
  totalFailed: number;
  deliveryRate: number;
  channelBreakdown: { channel: string; sent: number; failed: number }[];
  activePromos: number;
  birthdayPromos: { id: string; name: string; code: string; timesUsed: number }[];
  paymentReminders: { id: string; invoiceId: string; channel: string; sentAt: string }[];
}

export async function getNotificationStats(): Promise<NotificationStats> {
  const [
    channelsResult,
    promosResult,
    birthdayPromosResult,
    remindersResult,
  ] = await Promise.all([
    supabase.rpc('get_notification_channel_stats'),
    supabase
      .from('promotions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('promotions')
      .select('id, name, code, times_used')
      .eq('promotion_type', 'birthday')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('payment_reminders')
      .select('id, invoice_id, channel, sent_at')
      .order('sent_at', { ascending: false })
      .limit(20),
  ]);

  const channelBreakdown = (channelsResult.data ?? []).map((row) => ({
    channel: String(row.channel ?? ''),
    sent: Number(row.sent) || 0,
    failed: Number(row.failed) || 0,
  }));
  const totalSent = channelBreakdown.reduce((sum, row) => sum + row.sent, 0);
  const totalFailed = channelBreakdown.reduce((sum, row) => sum + row.failed, 0);
  const total = totalSent + totalFailed;
  const deliveryRate = total > 0 ? Math.round((totalSent / total) * 100) : 0;

  return {
    totalSent,
    totalFailed,
    deliveryRate,
    channelBreakdown,
    activePromos: promosResult.count ?? 0,
    birthdayPromos: (birthdayPromosResult.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      timesUsed: p.times_used ?? 0,
    })),
    paymentReminders: (remindersResult.data ?? []).map((r) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      channel: r.channel,
      sentAt: r.sent_at,
    })),
  };
}
