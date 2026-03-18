import { supabase } from '@/lib/supabase';

export interface NotificationStats {
  totalSent: number;
  totalFailed: number;
  deliveryRate: number;
  channelBreakdown: { channel: string; sent: number; failed: number }[];
  recentNotifications: {
    id: string;
    templateName: string;
    channel: string;
    recipientName: string;
    status: string;
    sentAt: string;
  }[];
  activePromos: number;
  birthdayPromos: { id: string; name: string; code: string; timesUsed: number }[];
  paymentReminders: { id: string; invoiceId: string; channel: string; sentAt: string }[];
}

export async function getNotificationStats(): Promise<NotificationStats> {
  const [
    notificationsResult,
    promosResult,
    birthdayPromosResult,
    remindersResult,
  ] = await Promise.all([
    supabase
      .from('notification_history')
      .select('id, template_name, channel, recipient_name, status, sent_at')
      .order('sent_at', { ascending: false })
      .limit(200),
    supabase
      .from('promotions')
      .select('id')
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

  const notifications = notificationsResult.data ?? [];

  // Compute aggregations
  const totalSent = notifications.filter((n) => n.status === 'sent' || n.status === 'delivered').length;
  const totalFailed = notifications.filter((n) => n.status === 'failed').length;
  const total = totalSent + totalFailed;
  const deliveryRate = total > 0 ? Math.round((totalSent / total) * 100) : 0;

  // Channel breakdown
  const channelMap = new Map<string, { sent: number; failed: number }>();
  for (const n of notifications) {
    const entry = channelMap.get(n.channel) ?? { sent: 0, failed: 0 };
    if (n.status === 'sent' || n.status === 'delivered') entry.sent++;
    else if (n.status === 'failed') entry.failed++;
    channelMap.set(n.channel, entry);
  }
  const channelBreakdown = Array.from(channelMap.entries()).map(([channel, stats]) => ({
    channel,
    ...stats,
  }));

  // Recent (last 50)
  const recentNotifications = notifications.slice(0, 50).map((n) => ({
    id: n.id,
    templateName: n.template_name ?? '',
    channel: n.channel ?? '',
    recipientName: n.recipient_name ?? '',
    status: n.status ?? '',
    sentAt: n.sent_at ?? '',
  }));

  return {
    totalSent,
    totalFailed,
    deliveryRate,
    channelBreakdown,
    recentNotifications,
    activePromos: promosResult.data?.length ?? 0,
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
