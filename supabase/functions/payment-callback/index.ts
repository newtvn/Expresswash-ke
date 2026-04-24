/**
 * Supabase Edge Function: Payment Callback
 * Receives payment confirmations from Co-op Bank / M-Pesa
 *
 * Endpoint: POST /functions/v1/payment-callback
 * Auth: Public (called by bank, not authenticated users)
 *
 * Request Body (from Co-op Bank):
 * {
 *   merchantRequestId: string,
 *   checkoutRequestId: string,
 *   resultCode: number,        // 0 = success, other = failed
 *   resultDesc: string,
 *   amount?: number,
 *   mpesaReceiptNumber?: string,
 *   transactionDate?: string,
 *   phoneNumber?: string
 * }
 *
 * Response:
 * {
 *   success: boolean
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from '../_shared/logger.ts';

// ============================================================
// CONFIGURATION
// ============================================================

const ALLOWED_IPS = Deno.env.get('BANK_CALLBACK_IPS')?.split(',') || [];

// ============================================================
// CORS HEADERS
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Validate callback authenticity
 * In production, verify IP address, signature, etc.
 */
function validateCallback(req: Request): boolean {
  // Get client IP from headers
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                   req.headers.get('x-real-ip') ||
                   'unknown';

  console.log('Callback received from IP:', clientIp);

  // If IP whitelist configured, verify
  if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(clientIp)) {
    console.warn('Callback from unauthorized IP:', clientIp);
    return false;
  }

  // Add additional validation here:
  // - Verify request signature if bank provides one
  // - Check timestamp to prevent replay attacks
  // - Validate request format

  return true;
}

/**
 * Queue notification to customer via notification_history table.
 * The send-notification Edge Function (invoked by pg_cron) picks up
 * pending rows and dispatches SMS via Africa's Talking / email via Resend.
 */
async function sendPaymentNotification(
  supabaseClient: ReturnType<typeof createClient>,
  orderId: string,
  status: string,
  transactionId: string | null
): Promise<void> {
  try {
    // Get order + invoice + customer details
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

    const customerName = (order.profiles as Record<string, unknown>)?.name as string || 'Customer';
    const customerEmail = (order.profiles as Record<string, unknown>)?.email as string | null;
    const customerPhone = (order.profiles as Record<string, unknown>)?.phone as string | null;

    // Get invoice for this order (if exists)
    const { data: invoice } = await supabaseClient
      .from('invoices')
      .select('invoice_number')
      .eq('order_id', orderId)
      .limit(1)
      .single();

    const invoiceNumber = invoice?.invoice_number || '';
    const orderNumber = order.tracking_code || '';
    const amount = order.total ? Number(order.total).toLocaleString() : '0';

    if (status === 'completed') {
      // Fetch SMS template
      const { data: smsTpl } = await supabaseClient
        .from('notification_templates')
        .select('body')
        .eq('name', 'Payment Confirmation')
        .eq('channel', 'sms')
        .limit(1)
        .single();

      // Queue SMS notification
      if (smsTpl?.body && customerPhone) {
        let smsBody = smsTpl.body as string;
        smsBody = smsBody.replace(/\{\{customerName\}\}/g, customerName);
        smsBody = smsBody.replace(/\{\{amount\}\}/g, amount);
        smsBody = smsBody.replace(/\{\{orderNumber\}\}/g, orderNumber);
        smsBody = smsBody.replace(/\{\{invoiceNumber\}\}/g, invoiceNumber);
        smsBody = smsBody.replace(/\{\{paymentMethod\}\}/g, 'M-Pesa');

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

      // Fetch email template
      const { data: emailTpl } = await supabaseClient
        .from('notification_templates')
        .select('subject, body')
        .eq('name', 'Payment Confirmation')
        .eq('channel', 'email')
        .limit(1)
        .single();

      // Queue email notification
      if (emailTpl?.body && customerEmail) {
        let emailBody = emailTpl.body as string;
        emailBody = emailBody.replace(/\{\{customerName\}\}/g, customerName);
        emailBody = emailBody.replace(/\{\{amount\}\}/g, amount);
        emailBody = emailBody.replace(/\{\{orderNumber\}\}/g, orderNumber);
        emailBody = emailBody.replace(/\{\{invoiceNumber\}\}/g, invoiceNumber);
        emailBody = emailBody.replace(/\{\{paymentMethod\}\}/g, 'M-Pesa');

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

      logger.info('Payment notifications queued', { orderId, sms: !!customerPhone, email: !!customerEmail });

    } else if (status === 'failed') {
      // Queue failure SMS (simple message, no template needed)
      if (customerPhone) {
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
    }

  } catch (error) {
    logger.error('Error queuing notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - notification failure shouldn't break callback processing
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Payment callback received');

    // Validate callback (optional security check)
    if (!validateCallback(req)) {
      logger.warn('Callback validation failed');
      // Still process to avoid payment issues, but log warning
    }

    // Parse callback data
    const raw = await req.json();
    logger.info('Raw callback data', { raw: JSON.stringify(raw) });

    // Extract data — handle Safaricom nested format, CreditBank wrapper, or flat
    // Safaricom format: { Body: { stkCallback: { CheckoutRequestID, ResultCode, CallbackMetadata: { Item: [...] } } } }
    // CreditBank wrapper: { data: { ... } }
    // Flat format: { CheckoutRequestID, ResultCode, ... }
    const stk = raw?.Body?.stkCallback || raw?.body?.stkCallback || raw?.data || raw;

    // Extract metadata items from Safaricom CallbackMetadata
    const metaItems: Array<{ Name: string; Value: unknown }> = stk?.CallbackMetadata?.Item || stk?.callbackMetadata?.Item || [];
    const getMeta = (name: string) => metaItems.find((i: { Name: string }) => i.Name === name)?.Value;

    const callback = {
      checkoutRequestId: stk.CheckoutRequestID || stk.checkoutRequestId,
      merchantRequestId: stk.MerchantRequestID || stk.merchantRequestId,
      resultCode: stk.ResultCode ?? stk.resultCode,
      resultDesc: stk.ResultDesc || stk.resultDesc,
      amount: getMeta('Amount') || stk.Amount || stk.amount,
      mpesaReceiptNumber: getMeta('MpesaReceiptNumber') || stk.MpesaReceiptNumber || stk.mpesaReceiptNumber,
      transactionDate: getMeta('TransactionDate') || stk.TransactionDate || stk.transactionDate,
      phoneNumber: getMeta('PhoneNumber') || stk.PhoneNumber || stk.phoneNumber,
    };

    logger.info('Callback data normalized', {
      checkoutRequestId: callback.checkoutRequestId,
      resultCode: callback.resultCode,
      resultDesc: callback.resultDesc,
      amount: callback.amount,
      mpesaReceiptNumber: callback.mpesaReceiptNumber,
    });

    // Validate required fields
    if (!callback.checkoutRequestId || callback.resultCode === undefined) {
      logger.error('Invalid callback data received', { raw });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid callback data',
          rawKeys: Object.keys(raw),
          rawData: raw,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client (with service role)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use stored procedure for idempotent, atomic payment processing
    // This prevents replay attacks and ensures data consistency
    const { data: result, error: processError } = await supabase
      .rpc('process_payment_callback', {
        p_checkout_request_id: callback.checkoutRequestId,
        p_merchant_request_id: callback.merchantRequestId,
        p_result_code: callback.resultCode,
        p_result_desc: callback.resultDesc,
        p_amount: callback.amount,
        p_mpesa_receipt_number: callback.mpesaReceiptNumber || null,
      });

    if (processError) {
      logger.error('Error processing payment callback', { error: processError.message });
      // Still return 200 to acknowledge callback
      return new Response(
        JSON.stringify({ success: true, note: 'Error logged for investigation' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    logger.info('Payment callback processed successfully', { success: result?.success });

    // If payment was already processed (idempotent), just return success
    if (result.idempotent) {
      return new Response(
        JSON.stringify({ success: true, note: 'Payment already processed' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get payment and order details for notifications
    const { data: payment } = await supabase
      .from('payments')
      .select('id, order_id')
      .eq('checkout_request_id', callback.checkoutRequestId)
      .single();

    if (payment) {
      const status = callback.resultCode === 0 ? 'completed' : 'failed';

      // Advance order status after successful payment
      // If order is at status 2 (Quote Sent), move to 3 (Quote Accepted)
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
          logger.info('Order status advanced to Quote Accepted after payment', { orderId: payment.order_id });
        }
      }

      // Send notification to customer
      await sendPaymentNotification(
        supabase,
        payment.order_id,
        status,
        callback.mpesaReceiptNumber || null
      );
    }

    // Always return success to bank (to acknowledge callback)
    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    logger.error('Callback processing error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // IMPORTANT: Still return 200 to bank to avoid retries
    // Log error for investigation but don't fail the callback
    return new Response(
      JSON.stringify({ success: true, error: 'Logged for investigation' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
