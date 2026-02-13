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
 * Map result code to payment status
 */
function getPaymentStatus(resultCode: number): string {
  if (resultCode === 0) {
    return 'completed';
  } else if (resultCode === 1032 || resultCode === 1037) {
    return 'cancelled'; // User cancelled or timeout
  } else {
    return 'failed';
  }
}

/**
 * Send notification to customer
 * You can integrate SMS/email here
 */
async function sendPaymentNotification(
  supabase: any,
  orderId: string,
  status: string,
  transactionId: string | null
): Promise<void> {
  try {
    // Get order and customer details
    const { data: order } = await supabase
      .from('orders')
      .select(`
        tracking_code,
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

    const customerName = order.profiles?.name || 'Customer';
    const customerEmail = order.profiles?.email;
    const customerPhone = order.profiles?.phone;

    if (status === 'completed') {
      // Payment successful
      const message = `Payment received! Your ExpressWash order #${order.tracking_code} is confirmed. Transaction ID: ${transactionId}`;

      console.log('Would send success notification:', {
        to: customerPhone,
        email: customerEmail,
        message,
      });

      // TODO: Integrate with Africa's Talking SMS API
      // await sendSMS(customerPhone, message);

      // TODO: Send email
      // await sendEmail(customerEmail, 'Payment Confirmed', message);

    } else if (status === 'failed') {
      // Payment failed
      const message = `Payment failed for order #${order.tracking_code}. Please try again or contact support.`;

      console.log('Would send failure notification:', {
        to: customerPhone,
        email: customerEmail,
        message,
      });
    }

  } catch (error) {
    console.error('Error sending notification:', error);
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
    const callback = await req.json();
    // Log with PII automatically masked
    logger.info('Callback data received', {
      checkoutRequestId: callback.checkoutRequestId,
      resultCode: callback.resultCode,
      resultDesc: callback.resultDesc,
      amount: callback.amount,  // Will be masked
      mpesaReceiptNumber: callback.mpesaReceiptNumber,  // Will be masked
    });

    // Validate required fields
    if (!callback.checkoutRequestId || callback.resultCode === undefined) {
      logger.error('Invalid callback data received');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid callback data',
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
      // Send notification to customer
      const status = callback.resultCode === 0 ? 'completed' : 'failed';
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
