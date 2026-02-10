import { supabase } from '@/lib/supabase';

// ── Types (local to this service) ─────────────────────────────────────

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'push';
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPayload {
  templateId: string;
  recipientId?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'push';
  variables: Record<string, string>;
}

export interface NotificationHistoryEntry {
  id: string;
  templateId: string;
  templateName: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'push';
  recipientId: string;
  recipientName: string;
  recipientContact: string;
  subject?: string;
  body: string;
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  sentAt: string;
  deliveredAt?: string;
  failureReason?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  message: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

function mapTemplate(row: Record<string, unknown>): NotificationTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    channel: row.channel as NotificationTemplate['channel'],
    subject: (row.subject as string) ?? undefined,
    body: row.body as string,
    variables: (row.variables as string[]) ?? [],
    isActive: (row.is_active as boolean) ?? true,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapHistory(row: Record<string, unknown>): NotificationHistoryEntry {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    templateName: row.template_name as string,
    channel: row.channel as NotificationHistoryEntry['channel'],
    recipientId: row.recipient_id as string,
    recipientName: row.recipient_name as string,
    recipientContact: row.recipient_contact as string,
    subject: (row.subject as string) ?? undefined,
    body: row.body as string,
    status: row.status as NotificationHistoryEntry['status'],
    sentAt: row.sent_at as string,
    deliveredAt: (row.delivered_at as string) ?? undefined,
    failureReason: (row.failure_reason as string) ?? undefined,
  };
}

// ── Public API ────────────────────────────────────────────────────────

export const getTemplates = async (): Promise<NotificationTemplate[]> => {
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map(mapTemplate);
};

export const sendNotification = async (
  payload: NotificationPayload,
): Promise<SendResult> => {
  const { data: template } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('id', payload.templateId)
    .single();

  if (!template) {
    return { success: false, message: 'Template not found' };
  }
  if (!template.is_active) {
    return { success: false, message: 'Template is inactive' };
  }

  const variables = (template.variables as string[]) ?? [];
  const missingVars = variables.filter((v: string) => !payload.variables[v]);
  if (missingVars.length > 0) {
    return { success: false, message: `Missing template variables: ${missingVars.join(', ')}` };
  }

  let body = template.body as string;
  for (const [key, value] of Object.entries(payload.variables)) {
    body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  let subject: string | undefined;
  if (template.subject) {
    subject = template.subject as string;
    for (const [key, value] of Object.entries(payload.variables)) {
      subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
  }

  const { data: entry, error } = await supabase
    .from('notification_history')
    .insert({
      template_id: template.id,
      template_name: template.name,
      channel: payload.channel,
      recipient_id: payload.recipientId ?? '',
      recipient_name: payload.variables.customerName ?? 'Unknown',
      recipient_contact: payload.recipientPhone ?? payload.recipientEmail ?? '',
      subject: subject ?? null,
      body,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !entry) {
    return { success: false, message: 'Failed to record notification' };
  }

  return { success: true, messageId: entry.id as string, message: `Notification sent via ${payload.channel}` };
};

export const getNotificationHistory = async (
  filters?: {
    recipientId?: string;
    channel?: 'sms' | 'email' | 'whatsapp' | 'push';
    status?: 'sent' | 'delivered' | 'failed' | 'pending';
    search?: string;
  },
): Promise<NotificationHistoryEntry[]> => {
  let query = supabase
    .from('notification_history')
    .select('*')
    .order('sent_at', { ascending: false });

  if (filters?.recipientId) {
    query = query.eq('recipient_id', filters.recipientId);
  }
  if (filters?.channel) {
    query = query.eq('channel', filters.channel);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    query = query.or(
      `recipient_name.ilike.%${filters.search}%,template_name.ilike.%${filters.search}%,body.ilike.%${filters.search}%`,
    );
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapHistory);
};
