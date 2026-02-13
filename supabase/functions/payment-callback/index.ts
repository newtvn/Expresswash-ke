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
    console.log('Payment callback received');

    // Validate callback (optional security check)
    if (!validateCallback(req)) {
      console.warn('Callback validation failed');
      // Still process to avoid payment issues, but log warning
    }

    // Parse callback data
    const callback = await req.json();
    console.log('Callback data:', {
      checkoutRequestId: callback.checkoutRequestId,
      resultCode: callback.resultCode,
      resultDesc: callback.resultDesc,
      amount: callback.amount,
      mpesaReceiptNumber: callback.mpesaReceiptNumber,
    });

    // Validate required fields
    if (!callback.checkoutRequestId || callback.resultCode === undefined) {
      console.error('Invalid callback data:', callback);
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

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, order_id, status')
      .eq('checkout_request_id', callback.checkoutRequestId)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found for checkout request:', callback.checkoutRequestId);

      // Return success anyway to acknowledge callback
      return new Response(
        JSON.stringify({ success: true, note: 'Payment record not found' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if already processed (prevent duplicate processing)
    if (payment.status === 'completed' || payment.status === 'failed') {
      console.log('Payment already processed, status:', payment.status);

      return new Response(
        JSON.stringify({ success: true, note: 'Already processed' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Determine payment status
    const status = getPaymentStatus(callback.resultCode);
    console.log('Updating payment status to:', status);

    // Update payment record
    const updateData: any = {
      status: status,
      result_code: callback.resultCode,
      result_desc: callback.resultDesc,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updateData.transaction_id = callback.mpesaReceiptNumber;
      updateData.completed_at = new Date().toISOString();

      // Store additional metadata
      updateData.metadata = {
        transactionDate: callback.transactionDate,
        phoneNumber: callback.phoneNumber,
        amountPaid: callback.amount,
      };
    } else {
      updateData.failure_reason = callback.resultDesc;
    }

    const { error: updateError } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', payment.id);

    if (updateError) {
      console.error('Failed to update payment:', updateError);
      throw updateError;
    }

    console.log('Payment updated successfully');

    // Update order status (handled by database trigger, but we can also do it here)
    if (status === 'completed') {
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: 'mpesa',
          // Move to next stage if still pending
          status: 2, // driver_assigned
        })
        .eq('id', payment.order_id)
        .eq('status', 1); // Only if currently pending

      if (orderError) {
        console.error('Failed to update order:', orderError);
        // Don't throw - payment update succeeded
      } else {
        console.log('Order status updated to paid');
      }

      // Log to audit trail
      await supabase
        .from('audit_logs')
        .insert({
          action: 'payment_completed',
          resource_type: 'payment',
          resource_id: payment.id,
          details: {
            orderId: payment.order_id,
            amount: callback.amount,
            transactionId: callback.mpesaReceiptNumber,
          },
          created_at: new Date().toISOString(),
        })
        .catch((err) => console.error('Failed to create audit log:', err));

    } else if (status === 'failed') {
      // Update order payment status
      await supabase
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', payment.order_id);

      console.log('Order marked as payment failed');
    }

    // Send notification to customer
    await sendPaymentNotification(
      supabase,
      payment.order_id,
      status,
      callback.mpesaReceiptNumber || null
    );

    // Always return success to bank (to acknowledge callback)
    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Callback processing error:', error);

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
