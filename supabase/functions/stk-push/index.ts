/**
 * Supabase Edge Function: STK Push
 * Initiates M-Pesa payment prompt to customer's phone via Credit Bank API
 *
 * Endpoint: POST /functions/v1/stk-push
 * Auth: Requires valid Supabase auth token
 *
 * Request Body:
 * {
 *   phoneNumber: string,  // 0712345678 or 254712345678
 *   amount: number,       // Amount in KES
 *   orderId: string,      // UUID of the order
 *   description?: string  // Optional transaction description
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   checkoutRequestId?: string,
 *   message?: string,
 *   error?: string
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from '../_shared/logger.ts';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../_shared/rateLimiter.ts';

// ============================================================
// CONFIGURATION
// ============================================================

const BANK_API_URL = Deno.env.get('BANK_API_BASE_URL') || 'https://sandboxkonnectapi.creditbank.co.ke';
const BANK_APP_ID = Deno.env.get('BANK_APP_ID');
const BANK_API_KEY = Deno.env.get('BANK_API_KEY');
const CALLBACK_BASE_URL = Deno.env.get('CALLBACK_BASE_URL');

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
 * Format phone number to 254XXXXXXXXX
 */
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-+]/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  }

  if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    cleaned = '254' + cleaned;
  }

  return cleaned;
}

/**
 * Validate Kenyan phone number
 */
function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  return /^254[71]\d{8}$/.test(formatted);
}

/**
 * Initiate STK Push with Credit Bank API
 * Auth: x-app-id + x-api-key headers
 * Endpoint: POST /safaricom-stkpush
 */
async function initiateSTKPush(
  phoneNumber: string,
  amount: number,
  reference: string,
  narration: string,
): Promise<Record<string, unknown>> {
  if (!BANK_APP_ID || !BANK_API_KEY) {
    throw new Error('Bank API credentials not configured (BANK_APP_ID / BANK_API_KEY)');
  }

  const requestBody = {
    phoneNumber: phoneNumber,
    amount: amount.toString(),
    reference: reference,
    countryCode: 'KE',
    narration: narration,
    callBackUrl: `${CALLBACK_BASE_URL}/payment-callback`,
    errorCallBackUrl: `${CALLBACK_BASE_URL}/payment-callback`,
  };

  logger.info('Initiating STK Push', {
    phoneNumber,
    amount: requestBody.amount,
    reference,
  });

  const response = await fetch(`${BANK_API_URL}/safaricom-stkpush`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-id': BANK_APP_ID,
      'x-api-key': BANK_API_KEY,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('STK Push failed', { status: response.status, error: errorText });
    throw new Error(`STK Push request failed: ${response.statusText}`);
  }

  const responseData = await response.json();
  logger.info('STK Push response received', { hasData: !!responseData });

  // CreditBank wraps the response in a `data` object with PascalCase fields:
  // { message: "...", data: { MerchantRequestID, CheckoutRequestID, ResponseCode, ... } }
  const data = responseData.data || responseData;

  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
    responseCode: data.ResponseCode,
    responseDescription: data.ResponseDescription,
    customerMessage: data.CustomerMessage,
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting: 3 payment requests per minute per IP
  const rateLimitResult = checkRateLimit(req, RATE_LIMITS.PAYMENT);
  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit exceeded for STK Push');
    return createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  try {
    // Parse request body
    const { phoneNumber, amount, orderId, description } = await req.json();

    logger.info('STK Push request received', { phoneNumber, amount, orderId });

    // Validate inputs
    if (!phoneNumber || !amount || !orderId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: phoneNumber, amount, orderId',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!isValidPhoneNumber(formattedPhone)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid phone number. Use format: 0712345678 or +254712345678',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate amount
    if (amount < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Minimum payment amount is KES 10',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client (with service role for database access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify order exists
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, tracking_code, customer_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Order not found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if payment already exists and is completed
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('status')
      .eq('order_id', orderId)
      .eq('status', 'completed')
      .single();

    if (existingPayment) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Order already paid',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initiate STK Push
    const stkResponse = await initiateSTKPush(
      formattedPhone,
      amount,
      orderId,
      description || `ExpressWash Order ${order.tracking_code}`,
    );

    // Save payment record to database
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        amount: amount,
        method: 'mpesa',
        status: 'processing',
        phone_number: formattedPhone,
        checkout_request_id: stkResponse.checkoutRequestId,
        merchant_request_id: stkResponse.merchantRequestId,
        result_code: stkResponse.responseCode,
        result_desc: stkResponse.responseDescription,
      });

    if (paymentError) {
      logger.error('Failed to save payment record', { error: paymentError.message });
      // Continue anyway - payment was initiated
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        checkoutRequestId: stkResponse.checkoutRequestId,
        merchantRequestId: stkResponse.merchantRequestId,
        message: stkResponse.customerMessage || 'STK Push sent. Check your phone.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    logger.error('STK Push error', { error: error instanceof Error ? error.message : 'Unknown error' });

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
