/**
 * Supabase Edge Function: STK Push
 * Initiates M-Pesa payment prompt to customer's phone
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

const BANK_API_URL = Deno.env.get('BANK_API_BASE_URL') || 'https://api.creditbank.co.ke';
const BANK_CONSUMER_KEY = Deno.env.get('BANK_CONSUMER_KEY');
const BANK_CONSUMER_SECRET = Deno.env.get('BANK_CONSUMER_SECRET');
const CALLBACK_BASE_URL = Deno.env.get('CALLBACK_BASE_URL');

// Token cache (persists across function invocations in same instance)
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

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
 * Get access token from Credit Bank API
 * Uses caching to avoid unnecessary API calls
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    logger.debug('Using cached access token');
    return cachedToken;
  }

  logger.debug('Requesting new access token');

  if (!BANK_CONSUMER_KEY || !BANK_CONSUMER_SECRET) {
    throw new Error('Bank API credentials not configured');
  }

  // Create Basic Auth credentials
  const credentials = btoa(`${BANK_CONSUMER_KEY}:${BANK_CONSUMER_SECRET}`);

  const response = await fetch(`${BANK_API_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Token request failed', { status: response.status, error: errorText });
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const data = await response.json();

  // Cache token (with 1-minute buffer before expiry)
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + ((data.expires_in - 60) * 1000);

  logger.info('Access token obtained', { expiresIn: data.expires_in });

  return cachedToken;
}

/**
 * Initiate STK Push with Credit Bank API
 * Endpoint: POST /safaricom-stkpush
 */
async function initiateSTKPush(
  phoneNumber: string,
  amount: number,
  reference: string,
  narration: string,
): Promise<Record<string, unknown>> {
  const accessToken = await getAccessToken();

  const requestBody = {
    phoneNumber: phoneNumber,
    amount: amount.toString(),
    reference: reference,
    countryCode: 'KE',
    narration: narration,
    callbackUrl: `${CALLBACK_BASE_URL}/payment-callback`,
    errorCallbackUrl: `${CALLBACK_BASE_URL}/payment-callback`,
  };

  // Log with PII masked
  logger.info('Initiating STK Push', {
    phoneNumber,  // Will be masked automatically
    amount: requestBody.amount,  // Will be masked automatically
    reference,
  });

  const response = await fetch(`${BANK_API_URL}/safaricom-stkpush`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('STK Push failed', { status: response.status, error: errorText });
    throw new Error(`STK Push request failed: ${response.statusText}`);
  }

  const data = await response.json();
  logger.info('STK Push response received', { hasData: !!data });

  return data;
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
