import { supabase } from '@/lib/supabase';

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

export interface NotificationHistoryEntry {
  id: string;
  templateId?: string;
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

export interface SendNotificationPayload {
  templateId: string;
  recipientId: string;
  recipientName: string;
  recipientContact: string;
  variables: Record<string, string>;
}

function mapTemplate(row: Record<string, unknown>): NotificationTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    channel: row.channel as NotificationTemplate['channel'],
    subject: (row.subject as string) ?? undefined,
    body: row.body as string,
    variables: (row.variables as string[]) ?? [],
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapHistory(row: Record<string, unknown>): NotificationHistoryEntry {
  return {
    id: row.id as string,
    templateId: (row.template_id as string) ?? undefined,
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

export const getTemplates = async (): Promise<NotificationTemplate[]> => {
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error || !data) return [];
  return data.map(mapTemplate);
};

export const createTemplate = async (
  template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<{ success: boolean; template?: NotificationTemplate }> => {
  const { data, error } = await supabase
    .from('notification_templates')
    .insert({
      name: template.name,
      channel: template.channel,
      subject: template.subject ?? null,
      body: template.body,
      variables: template.variables,
      is_active: template.isActive,
    })
    .select()
    .single();

  if (error || !data) return { success: false };
  return { success: true, template: mapTemplate(data) };
};

export const sendNotification = async (
  payload: SendNotificationPayload,
): Promise<{ success: boolean; historyId?: string; error?: string }> => {
  const { data: template, error: tError } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('id', payload.templateId)
    .single();

  if (tError || !template) {
    return { success: false, error: 'Template not found' };
  }

  // Replace variables in body
  let body = template.body as string;
  let subject = (template.subject as string) ?? '';
  Object.entries(payload.variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    body = body.replaceAll(placeholder, value);
    subject = subject.replaceAll(placeholder, value);
  });

  const { data: history, error: hError } = await supabase
    .from('notification_history')
    .insert({
      template_id: payload.templateId,
      template_name: template.name,
      channel: template.channel,
      recipient_id: payload.recipientId,
      recipient_name: payload.recipientName,
      recipient_contact: payload.recipientContact,
      subject: subject || null,
      body,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (hError || !history) {
    return { success: false, error: 'Failed to record notification' };
  }

  return { success: true, historyId: history.id as string };
};

export const getNotificationHistory = async (
  recipientId?: string,
  channel?: string,
): Promise<NotificationHistoryEntry[]> => {
  let query = supabase
    .from('notification_history')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(100);

  if (recipientId) query = query.eq('recipient_id', recipientId);
  if (channel) query = query.eq('channel', channel);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapHistory);
};
