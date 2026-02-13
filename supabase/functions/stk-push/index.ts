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

// ============================================================
// CONFIGURATION
// ============================================================

const BANK_API_URL = Deno.env.get('BANK_API_BASE_URL') || 'https://api.co-opbank.co.ke';
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
 * Get access token from Co-op Bank API
 * Uses caching to avoid unnecessary API calls
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    console.log('Using cached access token');
    return cachedToken;
  }

  console.log('Requesting new access token');

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
    console.error('Token request failed:', response.status, errorText);
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const data = await response.json();

  // Cache token (with 1-minute buffer before expiry)
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + ((data.expires_in - 60) * 1000);

  console.log('Access token obtained, expires in', data.expires_in, 'seconds');

  return cachedToken;
}

/**
 * Initiate STK Push with Co-op Bank API
 */
async function initiateSTKPush(
  phoneNumber: string,
  amount: number,
  accountReference: string,
  transactionDesc: string,
): Promise<any> {
  const accessToken = await getAccessToken();

  const requestBody = {
    phoneNumber: phoneNumber,
    amount: amount.toFixed(2),
    accountReference: accountReference,
    transactionDesc: transactionDesc,
    callbackUrl: `${CALLBACK_BASE_URL}/payment-callback`,
  };

  console.log('Initiating STK Push:', {
    phoneNumber,
    amount: requestBody.amount,
    accountReference,
  });

  const response = await fetch(`${BANK_API_URL}/v1/payment/stk-push`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('STK Push failed:', response.status, errorText);
    throw new Error(`STK Push request failed: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('STK Push response:', data);

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

  try {
    // Parse request body
    const { phoneNumber, amount, orderId, description } = await req.json();

    console.log('STK Push request received:', { phoneNumber, amount, orderId });

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
      description || `ExpressWash Order #${order.tracking_code}`,
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
      console.error('Failed to save payment record:', paymentError);
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
    console.error('STK Push error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
