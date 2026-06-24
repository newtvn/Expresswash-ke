/**
 * Supabase Edge Function: Payment Callback/IPN
 *
 * Public provider callback endpoint. For PesaPal, callbacks/IPNs only include
 * identifiers, so this function fetches authoritative transaction status before
 * updating the local payment projection through the idempotent database RPC.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from '../_shared/logger.ts';
import { getPaymentProvider, type ProviderPaymentStatus } from '../_shared/paymentProviders.ts';

const allowedIps = (
  Deno.env.get('PAYMENT_CALLBACK_IPS') || ''
)
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NormalizedCallback {
  provider: 'pesapal' | 'legacy';
  checkoutRequestId: string;
  merchantRequestId?: string;
  resultCode: number;
  resultDesc: string;
  amount?: number;
  mpesaReceiptNumber?: string;
  paymentMethod?: string;
  payerPhoneNumber?: string;
  notificationType?: string;
  raw: Record<string, unknown>;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function validateCallback(req: Request): boolean {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';

  if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
    logger.warn('Payment callback from unlisted IP', { clientIp });
    return false;
  }

  return true;
}

async function parseIncomingPayload(req: Request): Promise<Record<string, unknown>> {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  if (req.method === 'GET') {
    return queryParams;
  }

  const text = await req.text();
  if (!text.trim()) {
    return queryParams;
  }

  const contentType = req.headers.get('content-type') || '';
  let body: Record<string, unknown> = {};

  if (contentType.includes('application/x-www-form-urlencoded')) {
    body = Object.fromEntries(new URLSearchParams(text).entries());
  } else {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  return { ...body, ...queryParams };
}

function getFirstString(source: Record<string, unknown>, names: string[]): string | undefined {
  const lowered = new Map(
    Object.entries(source).map(([key, value]) => [key.toLowerCase(), value]),
  );

  for (const name of names) {
    const value = source[name] ?? lowered.get(name.toLowerCase());
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }

  return undefined;
}

function getNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : undefined;
}

function getMeta(stk: Record<string, unknown>, name: string): unknown {
  const callbackMetadata = stk.CallbackMetadata as { Item?: Array<{ Name: string; Value: unknown }> } | undefined;
  const callbackMetadataLower = stk.callbackMetadata as { Item?: Array<{ Name: string; Value: unknown }> } | undefined;
  const items = callbackMetadata?.Item || callbackMetadataLower?.Item || [];
  return items.find((item) => item.Name === name)?.Value;
}

function isPesapalPayload(raw: Record<string, unknown>): boolean {
  return Boolean(getFirstString(raw, ['OrderTrackingId', 'orderTrackingId']));
}

async function normalizePesapalCallback(raw: Record<string, unknown>): Promise<NormalizedCallback> {
  const orderTrackingId = getFirstString(raw, ['OrderTrackingId', 'orderTrackingId']);
  if (!orderTrackingId) {
    throw new Error('Missing PesaPal OrderTrackingId');
  }

  const provider = getPaymentProvider();
  const status: ProviderPaymentStatus = await provider.getPaymentStatus(orderTrackingId);
  const merchantReference = getFirstString(raw, ['OrderMerchantReference', 'orderMerchantReference'])
    || status.providerReference;

  return {
    provider: 'pesapal',
    checkoutRequestId: orderTrackingId,
    merchantRequestId: merchantReference,
    resultCode: status.appResultCode,
    resultDesc: status.resultDescription,
    amount: status.amount,
    mpesaReceiptNumber: status.confirmationCode,
    paymentMethod: status.paymentMethod,
    payerPhoneNumber: status.payerPhoneNumber,
    notificationType: getFirstString(raw, ['OrderNotificationType', 'orderNotificationType']),
    raw: {
      callback: raw,
      transactionStatus: status.raw,
      providerStatus: status.providerStatus,
    },
  };
}

function normalizeLegacyCallback(raw: Record<string, unknown>): NormalizedCallback {
  const container = raw.Body as Record<string, unknown> | undefined;
  const body = raw.body as Record<string, unknown> | undefined;
  const data = raw.data as Record<string, unknown> | undefined;
  const stk = (
    (container?.stkCallback as Record<string, unknown> | undefined)
    || (body?.stkCallback as Record<string, unknown> | undefined)
    || data
    || raw
  );

  const checkoutRequestId = getFirstString(stk, ['CheckoutRequestID', 'checkoutRequestId']);
  const resultCode = getNumber(stk.ResultCode ?? stk.resultCode);

  if (!checkoutRequestId || resultCode === undefined) {
    throw new Error('Invalid payment callback data');
  }

  return {
    provider: 'legacy',
    checkoutRequestId,
    merchantRequestId: getFirstString(stk, ['MerchantRequestID', 'merchantRequestId']),
    resultCode,
    resultDesc: getFirstString(stk, ['ResultDesc', 'resultDesc']) || 'Payment callback received',
    amount: getNumber(getMeta(stk, 'Amount') ?? stk.Amount ?? stk.amount),
    mpesaReceiptNumber: getFirstString({
      receipt: getMeta(stk, 'MpesaReceiptNumber') ?? stk.MpesaReceiptNumber ?? stk.mpesaReceiptNumber,
    }, ['receipt']),
    paymentMethod: 'M-Pesa',
    raw,
  };
}

function pesapalAcknowledgement(callback: Partial<NormalizedCallback>, status: 200 | 500): Record<string, unknown> {
  return {
    orderNotificationType: callback.notificationType || 'IPNCHANGE',
    orderTrackingId: callback.checkoutRequestId || '',
    orderMerchantReference: callback.merchantRequestId || '',
    status,
  };
}

/**
 * Queue notification to customer via notification_history table.
 * A separate worker/function handles external SMS/email delivery.
 */
async function queuePaymentNotification(
  supabaseClient: ReturnType<typeof createClient>,
  orderId: string | null,
  status: string,
  paymentMethodLabel: string,
): Promise<void> {
  if (!orderId) return;

  try {
    const { data: order } = await supabaseClient
      .from('orders')
      .select(`
        tracking_code,
        total,
        customer_id,
        profiles:customer_id (
          name,
          email,
          phone
        )
      `)
      .eq('id', orderId)
      .single();

    if (!order) return;

    const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
    const customerName = (profile as Record<string, unknown>)?.name as string || 'Customer';
    const customerEmail = (profile as Record<string, unknown>)?.email as string | null;
    const customerPhone = (profile as Record<string, unknown>)?.phone as string | null;

    const { data: invoice } = await supabaseClient
      .from('invoices')
      .select('invoice_number')
      .eq('order_id', orderId)
      .limit(1)
      .maybeSingle();

    const invoiceNumber = invoice?.invoice_number || '';
    const orderNumber = order.tracking_code || '';
    const amount = order.total ? Number(order.total).toLocaleString() : '0';

    if (status === 'completed') {
      const { data: smsTpl } = await supabaseClient
        .from('notification_templates')
        .select('body')
        .eq('name', 'Payment Confirmation')
        .eq('channel', 'sms')
        .limit(1)
        .maybeSingle();

      if (smsTpl?.body && customerPhone) {
        let smsBody = smsTpl.body as string;
        smsBody = smsBody.replace(/\{\{customerName\}\}/g, customerName);
        smsBody = smsBody.replace(/\{\{amount\}\}/g, amount);
        smsBody = smsBody.replace(/\{\{orderNumber\}\}/g, orderNumber);
        smsBody = smsBody.replace(/\{\{invoiceNumber\}\}/g, invoiceNumber);
        smsBody = smsBody.replace(/\{\{paymentMethod\}\}/g, paymentMethodLabel);

        await supabaseClient.from('notification_history').insert({
          recipient_id: order.customer_id,
          recipient_name: customerName,
          recipient_contact: customerPhone,
          channel: 'sms',
          template_name: 'Payment Confirmation',
          body: smsBody,
          status: 'pending',
        });
      }

      const { data: emailTpl } = await supabaseClient
        .from('notification_templates')
        .select('subject, body')
        .eq('name', 'Payment Confirmation')
        .eq('channel', 'email')
        .limit(1)
        .maybeSingle();

      if (emailTpl?.body && customerEmail) {
        let emailBody = emailTpl.body as string;
        emailBody = emailBody.replace(/\{\{customerName\}\}/g, customerName);
        emailBody = emailBody.replace(/\{\{amount\}\}/g, amount);
        emailBody = emailBody.replace(/\{\{orderNumber\}\}/g, orderNumber);
        emailBody = emailBody.replace(/\{\{invoiceNumber\}\}/g, invoiceNumber);
        emailBody = emailBody.replace(/\{\{paymentMethod\}\}/g, paymentMethodLabel);

        let emailSubject = (emailTpl.subject as string) || 'Payment Received';
        emailSubject = emailSubject.replace(/\{\{invoiceNumber\}\}/g, invoiceNumber);

        await supabaseClient.from('notification_history').insert({
          recipient_id: order.customer_id,
          recipient_name: customerName,
          recipient_contact: customerEmail,
          channel: 'email',
          template_name: 'Payment Confirmation',
          subject: emailSubject,
          body: emailBody,
          status: 'pending',
        });
      }

      logger.info('Payment notifications queued', { orderId, sms: Boolean(customerPhone), email: Boolean(customerEmail) });
    } else if (status === 'failed' && customerPhone) {
      await supabaseClient.from('notification_history').insert({
        recipient_id: order.customer_id,
        recipient_name: customerName,
        recipient_contact: customerPhone,
        channel: 'sms',
        template_name: 'Payment Confirmation',
        body: `Payment failed for order #${orderNumber}. Please try again or contact support.`,
        status: 'pending',
      });
    }
  } catch (error) {
    logger.error('Error queuing notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let callback: NormalizedCallback | null = null;

  try {
    if (!validateCallback(req)) {
      logger.warn('Payment callback IP validation failed');
    }

    const raw = await parseIncomingPayload(req);
    callback = isPesapalPayload(raw)
      ? await normalizePesapalCallback(raw)
      : normalizeLegacyCallback(raw);

    logger.info('Payment callback normalized', {
      provider: callback.provider,
      checkoutRequestId: callback.checkoutRequestId,
      merchantRequestId: callback.merchantRequestId,
      resultCode: callback.resultCode,
      notificationType: callback.notificationType,
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: result, error: processError } = await supabase
      .rpc('process_payment_callback', {
        p_checkout_request_id: callback.checkoutRequestId,
        p_merchant_request_id: callback.merchantRequestId ?? null,
        p_result_code: callback.resultCode,
        p_result_desc: callback.resultDesc,
        p_amount: callback.amount ?? null,
        p_mpesa_receipt_number: callback.mpesaReceiptNumber || null,
        p_provider_payload: callback.raw,
        p_payer_phone_number: callback.payerPhoneNumber || null,
      });
    const processResult = result as { success?: boolean; error?: string; idempotent?: boolean } | null;

    if (processError || processResult?.success === false) {
      logger.error('Error processing payment callback', {
        error: processError?.message || processResult?.error || 'Payment callback rejected',
        checkoutRequestId: callback.checkoutRequestId,
      });

      if (callback.provider === 'pesapal') {
        return jsonResponse(pesapalAcknowledgement(callback, 500));
      }

      return jsonResponse({ success: true, note: 'Error logged for investigation' });
    }

    if (processResult?.idempotent) {
      return callback.provider === 'pesapal'
        ? jsonResponse(pesapalAcknowledgement(callback, 200))
        : jsonResponse({ success: true, note: 'Payment already processed' });
    }

    const paymentLookupFilters = [
      `checkout_request_id.eq.${callback.checkoutRequestId}`,
      `provider_payment_id.eq.${callback.checkoutRequestId}`,
    ];
    if (callback.merchantRequestId) {
      paymentLookupFilters.push(`provider_reference.eq.${callback.merchantRequestId}`);
    }

    const { data: payment } = await supabase
      .from('payments')
      .select('id, order_id')
      .or(paymentLookupFilters.join(','))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (payment) {
      const status = callback.resultCode === 0 ? 'completed' : 'failed';

      if (status === 'completed' && payment.order_id) {
        const { data: order } = await supabase
          .from('orders')
          .select('status')
          .eq('id', payment.order_id)
          .single();

        if (order && order.status === 2) {
          await supabase
            .from('orders')
            .update({ status: 3, updated_at: new Date().toISOString() })
            .eq('id', payment.order_id);
          logger.info('Order status advanced after payment', { orderId: payment.order_id });
        }
      }

      await queuePaymentNotification(
        supabase,
        payment.order_id,
        status,
        callback.paymentMethod || 'M-Pesa',
      );
    }

    return callback.provider === 'pesapal'
      ? jsonResponse(pesapalAcknowledgement(callback, 200))
      : jsonResponse({ success: true });
  } catch (error) {
    logger.error('Callback processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (callback?.provider === 'pesapal') {
      return jsonResponse(pesapalAcknowledgement(callback, 500));
    }

    return jsonResponse({ success: true, error: 'Logged for investigation' });
  }
});
