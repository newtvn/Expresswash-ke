/**
 * Supabase Edge Function: Send Notification
 * Processes the notification queue — sends SMS via Africa's Talking
 * and email via Resend.
 *
 * Endpoint: POST /functions/v1/send-notification
 * Auth: Requires service role key (called by pg_cron, not end users)
 *
 * Reads from notification_history where status = 'pending'.
 * Updates to 'sent' on success or 'failed' after 3 retries.
 *
 * Column reference (notification_history):
 *   recipient_contact  — phone number or email address
 *   body               — rendered notification content
 *   failure_reason     — error message on failure
 *   retry_count        — number of send attempts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from '../_shared/logger.ts';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../_shared/rateLimiter.ts';

// ============================================================
// CONFIGURATION
// ============================================================

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
const atApiKey = Deno.env.get('AFRICASTALKING_API_KEY')!;
const atUsername = Deno.env.get('AFRICASTALKING_USERNAME')!;
const atSenderId = Deno.env.get('AFRICASTALKING_SENDER_ID') || '';
const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'ExpressWash <onboarding@resend.dev>';

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;

// ============================================================
// CORS HEADERS
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit: API preset (30/min)
  const rateLimitResult = checkRateLimit(req, RATE_LIMITS.API);
  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit exceeded for send-notification');
    return createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending notifications (status = 'pending' — the queue status)
    const { data: pending, error: fetchError } = await supabase
      .from('notification_history')
      .select('*')
      .eq('status', 'pending')
      .order('sent_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      logger.error('Failed to fetch notification queue', { error: fetchError.message });
      return jsonResponse({ error: fetchError.message }, 500);
    }

    if (!pending || pending.length === 0) {
      return jsonResponse({ processed: 0, failed: 0, message: 'Queue empty' });
    }

    logger.info(`Processing ${pending.length} pending notifications`);

    let processed = 0;
    let failed = 0;

    for (const notification of pending) {
      try {
        // Skip if max retries exceeded
        if ((notification.retry_count || 0) >= MAX_RETRIES) {
          await markFailed(supabase, notification.id, 'Max retries exceeded');
          failed++;
          continue;
        }

        // Send based on channel
        if (notification.channel === 'sms' || notification.channel === 'whatsapp') {
          // TODO: WhatsApp Business API not yet configured; falls back to SMS
          await sendSMS(notification.recipient_contact, notification.body);
        } else if (notification.channel === 'email') {
          await sendEmail(
            notification.recipient_contact,
            notification.subject || 'ExpressWash Update',
            notification.body,
          );
        } else {
          logger.warn(`Unknown channel: ${notification.channel}`, {
            notificationId: notification.id,
          });
          await markFailed(supabase, notification.id, `Unknown channel: ${notification.channel}`);
          failed++;
          continue;
        }

        // Mark as sent
        await supabase
          .from('notification_history')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        processed++;
        logger.info(`Sent ${notification.channel} notification`, {
          channel: notification.channel,
          recipientContact: notification.recipient_contact,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to send ${notification.channel} notification`, {
          channel: notification.channel,
          recipientContact: notification.recipient_contact,
          error: errorMessage,
        });

        const retryCount = (notification.retry_count || 0) + 1;
        const newStatus = retryCount >= MAX_RETRIES ? 'failed' : 'pending';

        await supabase
          .from('notification_history')
          .update({
            status: newStatus,
            failure_reason: errorMessage.substring(0, 500),
            retry_count: retryCount,
          })
          .eq('id', notification.id);

        failed++;
      }
    }

    logger.info('Notification queue processed', { processed, failed, total: pending.length });
    return jsonResponse({ processed, failed, total: pending.length });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('send-notification fatal error', { error: errorMessage });
    return jsonResponse({ error: errorMessage }, 500);
  }
});

// ============================================================
// SMS SENDER (Africa's Talking)
// ============================================================

async function sendSMS(to: string, message: string): Promise<void> {
  // Ensure phone number starts with +
  const phone = to.startsWith('+') ? to : `+${to}`;

  const params = new URLSearchParams({
    username: atUsername,
    to: phone,
    message: message,
  });

  // Only add sender ID if configured (may be pending approval)
  if (atSenderId) {
    params.append('from', atSenderId);
  }

  // Sandbox uses a different host than production
  const baseUrl = atUsername === 'sandbox'
    ? 'https://api.sandbox.africastalking.com'
    : 'https://api.africastalking.com';

  const response = await fetch(
    `${baseUrl}/version1/messaging`,
    {
      method: 'POST',
      headers: {
        apiKey: atApiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params,
    },
  );

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Africa's Talking HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  // Check for per-recipient delivery failures
  const recipients = body?.SMSMessageData?.Recipients || [];
  if (recipients.length > 0 && recipients[0].status === 'Failed') {
    throw new Error(
      `SMS delivery failed: ${recipients[0].status} - ${recipients[0].statusCode}`,
    );
  }
}

// ============================================================
// EMAIL SENDER (Resend)
// ============================================================

async function sendEmail(to: string, subject: string, htmlContent: string): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [to],
      subject: subject,
      html: htmlContent,
    }),
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(`Resend HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
}

// ============================================================
// HELPERS
// ============================================================

async function markFailed(
  supabase: ReturnType<typeof createClient>,
  id: string,
  reason: string,
) {
  await supabase
    .from('notification_history')
    .update({
      status: 'failed',
      failure_reason: reason,
    })
    .eq('id', id);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
