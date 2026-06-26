/**
 * Supabase Edge Function: Notification Worker
 *
 * Processes notification_outbox rows claimed through
 * claim_notification_outbox_batch(...). Delivery attempts are recorded through
 * mark_notification_attempt(...) so replay/retry state stays in the database.
 *
 * Endpoint: POST /functions/v1/notification-worker
 * Body: { "limit": 25 }
 * Auth: service role only
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from '../_shared/logger.ts';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../_shared/rateLimiter.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
const atApiKey = Deno.env.get('AFRICASTALKING_API_KEY') || '';
const atUsername = Deno.env.get('AFRICASTALKING_USERNAME') || '';
const atSenderId = Deno.env.get('AFRICASTALKING_SENDER_ID') || '';
const whatsappWebhookUrl = Deno.env.get('WHATSAPP_WEBHOOK_URL') || '';
const whatsappWebhookToken = Deno.env.get('WHATSAPP_WEBHOOK_TOKEN') || '';

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type OutboxRow = {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string | null;
  channel: 'whatsapp' | 'sms' | 'email' | 'push' | 'webhook';
  recipient_contact: string;
  recipient_name: string | null;
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
};

type DeliveryMessage = {
  provider: string;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  responseStatus: number | null;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${supabaseServiceKey}`) {
    return jsonResponse({ error: 'Service role authorization required' }, 401);
  }

  const rateLimitResult = checkRateLimit(req, RATE_LIMITS.API);
  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit exceeded for notification-worker');
    return createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  try {
    const body = await safeJson(req);
    const limit = Math.min(
      Math.max(Number(body.limit ?? DEFAULT_BATCH_SIZE) || DEFAULT_BATCH_SIZE, 1),
      MAX_BATCH_SIZE,
    );
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: claimed, error: claimError } = await supabase.rpc(
      'claim_notification_outbox_batch',
      { p_limit: limit },
    );

    if (claimError) {
      logger.error('Failed to claim notification outbox rows', { error: claimError.message });
      return jsonResponse({ error: claimError.message }, 500);
    }

    const rows = (claimed ?? []) as OutboxRow[];
    if (rows.length === 0) {
      return jsonResponse({ processed: 0, failed: 0, total: 0, message: 'Outbox empty' });
    }

    let processed = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const rendered = await renderOutboxMessage(row);
        const delivery = await deliver(row, rendered.subject, rendered.body, rendered.html);

        await markAttempt(supabase, row.id, {
          provider: delivery.provider,
          requestPayload: delivery.requestPayload,
          responsePayload: delivery.responsePayload,
          responseStatus: delivery.responseStatus,
          success: true,
          errorMessage: null,
        });

        processed++;
        logger.info('Notification outbox item delivered', {
          outboxId: row.id,
          channel: row.channel,
          provider: delivery.provider,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await markAttempt(supabase, row.id, {
          provider: providerForChannel(row.channel),
          requestPayload: {
            event_type: row.event_type,
            aggregate_type: row.aggregate_type,
            aggregate_id: row.aggregate_id,
            channel: row.channel,
          },
          responsePayload: {},
          responseStatus: null,
          success: false,
          errorMessage: message.substring(0, 500),
        });

        failed++;
        logger.error('Notification outbox item failed', {
          outboxId: row.id,
          channel: row.channel,
          error: message,
        });
      }
    }

    return jsonResponse({ processed, failed, total: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('notification-worker fatal error', { error: message });
    return jsonResponse({ error: message }, 500);
  }
});

async function renderOutboxMessage(row: OutboxRow): Promise<{ subject: string; body: string; html: string }> {
  const payload = row.payload ?? {};

  if (row.event_type === 'invoice.sent' && row.aggregate_type === 'invoice') {
    const invoiceId = String(payload.invoice_id ?? row.aggregate_id ?? '');
    const invoiceNumber = String(payload.invoice_number ?? 'your invoice');
    const customerName = String(payload.customer_name ?? row.recipient_name ?? 'there');
    const total = formatMoney(payload.total);
    const balance = formatMoney(payload.balance);
    const pdfUrl = await ensurePdfUrl('invoice', invoiceId);
    const body = [
      `Hi ${customerName},`,
      `Your invoice ${invoiceNumber} from ExpressWash Kenya is ready.`,
      `Total: ${total}. Balance: ${balance}.`,
      pdfUrl ? `Download PDF: ${pdfUrl}` : '',
      'Thank you for your business.',
    ].filter(Boolean).join('\n');

    return {
      subject: `Invoice ${invoiceNumber}`,
      body,
      html: htmlMessage(`Invoice ${invoiceNumber}`, body, pdfUrl),
    };
  }

  if (row.event_type === 'payment.receipt' && row.aggregate_type === 'payment') {
    const paymentId = String(payload.payment_id ?? row.aggregate_id ?? '');
    const reference = String(payload.reference ?? payload.receipt_number ?? 'payment receipt');
    const customerName = String(payload.customer_name ?? row.recipient_name ?? 'there');
    const amount = formatMoney(payload.amount);
    const pdfUrl = await ensurePdfUrl('receipt', paymentId);
    const body = [
      `Hi ${customerName},`,
      `Your receipt for ${reference} is ready.`,
      amount ? `Amount: ${amount}.` : '',
      pdfUrl ? `Download receipt: ${pdfUrl}` : '',
      'Thank you.',
    ].filter(Boolean).join('\n');

    return {
      subject: `Receipt ${reference}`,
      body,
      html: htmlMessage(`Receipt ${reference}`, body, pdfUrl),
    };
  }

  const subject = String(payload.subject ?? 'ExpressWash Update');
  const body = String(payload.body ?? payload.message ?? 'You have a new update from ExpressWash Kenya.');
  return {
    subject,
    body,
    html: htmlMessage(subject, body),
  };

  async function ensurePdfUrl(type: 'invoice' | 'receipt', id: string): Promise<string> {
    if (!id) return '';

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-pdf`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, id }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`PDF generation failed: ${response.status} ${JSON.stringify(data)}`);
    }

    return String(data.url ?? '');
  }
}

async function deliver(
  row: OutboxRow,
  subject: string,
  body: string,
  html: string,
): Promise<DeliveryMessage> {
  if (row.channel === 'whatsapp') {
    return sendWhatsApp(row, body);
  }

  if (row.channel === 'sms') {
    return sendSms(row.recipient_contact, body, 'sms');
  }

  if (row.channel === 'email') {
    return sendEmail(row.recipient_contact, subject, html);
  }

  if (row.channel === 'webhook') {
    return sendWebhook(row, subject, body);
  }

  if (row.channel === 'push') {
    throw new Error('Push notification delivery is not configured');
  }

  throw new Error(`Unsupported channel: ${row.channel}`);
}

async function sendWhatsApp(row: OutboxRow, message: string): Promise<DeliveryMessage> {
  if (whatsappWebhookUrl) {
    const requestPayload = {
      to: row.recipient_contact,
      message,
      event_type: row.event_type,
      aggregate_type: row.aggregate_type,
      aggregate_id: row.aggregate_id,
      payload: row.payload,
    };

    const response = await fetch(whatsappWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(whatsappWebhookToken ? { Authorization: `Bearer ${whatsappWebhookToken}` } : {}),
      },
      body: JSON.stringify(requestPayload),
    });
    const responsePayload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`WhatsApp webhook HTTP ${response.status}: ${JSON.stringify(responsePayload)}`);
    }

    return {
      provider: 'whatsapp_webhook',
      requestPayload,
      responsePayload: {
        ...responsePayload,
        provider_message_id: responsePayload.id ?? responsePayload.message_id ?? null,
      },
      responseStatus: response.status,
    };
  }

  return sendSms(row.recipient_contact, message, 'whatsapp');
}

async function sendSms(to: string, message: string, sourceChannel: 'sms' | 'whatsapp'): Promise<DeliveryMessage> {
  if (!atApiKey || !atUsername) {
    throw new Error(sourceChannel === 'whatsapp'
      ? 'WhatsApp webhook and SMS fallback credentials are not configured'
      : 'Africa\'s Talking credentials are not configured');
  }

  const phone = to.startsWith('+') ? to : `+${to}`;
  const params = new URLSearchParams({
    username: atUsername,
    to: phone,
    message,
  });

  if (atSenderId) {
    params.append('from', atSenderId);
  }

  const baseUrl = atUsername === 'sandbox'
    ? 'https://api.sandbox.africastalking.com'
    : 'https://api.africastalking.com';

  const response = await fetch(`${baseUrl}/version1/messaging`, {
    method: 'POST',
    headers: {
      apiKey: atApiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params,
  });

  const responsePayload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Africa's Talking HTTP ${response.status}: ${JSON.stringify(responsePayload)}`);
  }

  const recipients = responsePayload?.SMSMessageData?.Recipients || [];
  if (recipients.length > 0 && recipients[0].status === 'Failed') {
    throw new Error(`SMS delivery failed: ${recipients[0].status} - ${recipients[0].statusCode}`);
  }

  return {
    provider: sourceChannel === 'whatsapp' ? 'africastalking_sms_whatsapp_fallback' : 'africastalking_sms',
    requestPayload: {
      channel: sourceChannel,
      to: phone,
      message,
    },
    responsePayload: {
      ...responsePayload,
      provider_message_id: recipients[0]?.messageId ?? responsePayload?.SMSMessageData?.Message ?? null,
    },
    responseStatus: response.status,
  };
}

async function sendEmail(to: string, subject: string, html: string): Promise<DeliveryMessage> {
  if (!resendApiKey) {
    throw new Error('Resend credentials are not configured');
  }

  const requestPayload = {
    from: Deno.env.get('RESEND_FROM_EMAIL') || 'ExpressWash <onboarding@resend.dev>',
    to: [to],
    subject,
    html,
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestPayload),
  });

  const responsePayload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend HTTP ${response.status}: ${JSON.stringify(responsePayload)}`);
  }

  return {
    provider: 'resend',
    requestPayload,
    responsePayload: {
      ...responsePayload,
      provider_message_id: responsePayload.id ?? null,
    },
    responseStatus: response.status,
  };
}

async function sendWebhook(row: OutboxRow, subject: string, body: string): Promise<DeliveryMessage> {
  const url = String(row.payload?.url ?? '');
  if (!url) {
    throw new Error('Webhook URL is required');
  }

  const requestPayload = {
    event_type: row.event_type,
    aggregate_type: row.aggregate_type,
    aggregate_id: row.aggregate_id,
    subject,
    body,
    payload: row.payload,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestPayload),
  });
  const responsePayload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Webhook HTTP ${response.status}: ${JSON.stringify(responsePayload)}`);
  }

  return {
    provider: 'webhook',
    requestPayload,
    responsePayload,
    responseStatus: response.status,
  };
}

async function markAttempt(
  supabase: ReturnType<typeof createClient>,
  outboxId: string,
  attempt: {
    provider: string;
    requestPayload: Record<string, unknown>;
    responsePayload: Record<string, unknown>;
    responseStatus: number | null;
    success: boolean;
    errorMessage: string | null;
  },
) {
  const { error } = await supabase.rpc('mark_notification_attempt', {
    p_outbox_id: outboxId,
    p_provider: attempt.provider,
    p_request_payload: attempt.requestPayload,
    p_response_payload: attempt.responsePayload,
    p_response_status: attempt.responseStatus,
    p_success: attempt.success,
    p_error_message: attempt.errorMessage,
  });

  if (error) {
    throw new Error(`Failed to mark notification attempt: ${error.message}`);
  }
}

function providerForChannel(channel: OutboxRow['channel']): string {
  if (channel === 'email') return 'resend';
  if (channel === 'sms') return 'africastalking_sms';
  if (channel === 'whatsapp') return 'africastalking_sms_whatsapp_fallback';
  if (channel === 'webhook') return 'webhook';
  return 'unconfigured';
}

function htmlMessage(title: string, body: string, url = ''): string {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replaceAll('\n', '<br>');
  const link = url
    ? `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 14px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px">Open document</a></p>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
      <h2>${safeTitle}</h2>
      <p>${safeBody}</p>
      ${link}
    </div>
  `;
}

function formatMoney(value: unknown): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return `KES ${amount.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#039;');
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
