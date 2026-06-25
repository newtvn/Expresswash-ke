/**
 * Supabase Edge Function: Start Payment
 *
 * Kept at /functions/v1/stk-push for frontend compatibility. Internally this
 * uses a provider adapter so moving from PesaPal to another processor is a
 * provider-code change, not a payment architecture rewrite.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from '../_shared/logger.ts';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../_shared/rateLimiter.ts';
import {
  buildMerchantReference,
  formatPhoneNumber,
  getPaymentProvider,
  isValidPhoneNumber,
} from '../_shared/paymentProviders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RelatedProfile = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type OrderRecord = {
  id: string;
  tracking_code: string;
  customer_id: string | null;
  total: number | string | null;
  profiles?: RelatedProfile | RelatedProfile[] | null;
};

function getProfile(order: OrderRecord): RelatedProfile {
  if (Array.isArray(order.profiles)) {
    return order.profiles[0] ?? {};
  }

  return order.profiles ?? {};
}

function getPaymentAmount(orderTotal: number, requestedAmount: number): number {
  const allowTestAmount = Deno.env.get('ALLOW_TEST_PAYMENT_AMOUNT') === 'true';
  if (allowTestAmount && Number.isFinite(requestedAmount)) {
    return requestedAmount;
  }

  return orderTotal;
}

function getMetadataValue(metadata: unknown, key: string): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResult = checkRateLimit(req, RATE_LIMITS.PAYMENT);
  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit exceeded for payment start');
    return createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  try {
    const { phoneNumber, amount, orderId, description } = await req.json();
    const requestedAmount = Number(amount);

    logger.info('Payment start request received', { phoneNumber, amount: requestedAmount, orderId });

    if (!phoneNumber || !Number.isFinite(requestedAmount) || !orderId) {
      return jsonResponse({
        success: false,
        error: 'Missing required fields: phoneNumber, amount, orderId',
      }, 400);
    }

    const formattedPhone = formatPhoneNumber(String(phoneNumber));
    if (!isValidPhoneNumber(formattedPhone)) {
      return jsonResponse({
        success: false,
        error: 'Invalid phone number. Use format: 0712345678 or +254712345678',
      }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const provider = getPaymentProvider();

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, tracking_code, customer_id, total, profiles:customer_id(name,email,phone)')
      .eq('id', orderId)
      .single();

    const order = orderData as OrderRecord | null;

    if (orderError || !order) {
      return jsonResponse({ success: false, error: 'Order not found' }, 404);
    }

    const orderTotal = Number(order.total ?? 0);
    const paymentAmount = getPaymentAmount(orderTotal, requestedAmount);
    if (!Number.isFinite(paymentAmount) || paymentAmount < 10) {
      return jsonResponse({ success: false, error: 'Minimum payment amount is KES 10' }, 400);
    }

    const { data: completedPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('order_id', orderId)
      .eq('status', 'completed')
      .maybeSingle();

    if (completedPayment) {
      return jsonResponse({ success: false, error: 'Order already paid' }, 400);
    }

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, checkout_request_id, merchant_request_id, provider, provider_payment_id, provider_reference, provider_metadata, result_desc')
      .eq('order_id', orderId)
      .eq('provider', provider.name)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const existingRedirectUrl = getMetadataValue(existingPayment?.provider_metadata, 'redirectUrl')
      ?? getMetadataValue(existingPayment?.provider_metadata, 'redirect_url');

    if (existingPayment && existingRedirectUrl) {
      logger.info('Returning existing in-flight payment intent', {
        orderId,
        paymentId: existingPayment.id,
        provider: provider.name,
      });

      return jsonResponse({
        success: true,
        provider: provider.name,
        checkoutRequestId: existingPayment.checkout_request_id ?? existingPayment.provider_payment_id,
        merchantRequestId: existingPayment.merchant_request_id ?? existingPayment.provider_reference,
        redirectUrl: existingRedirectUrl,
        message: existingPayment.result_desc || 'Continue to PesaPal to complete payment.',
        idempotent: true,
      });
    }

    const profile = getProfile(order);
    const merchantReference = buildMerchantReference(order.tracking_code);
    const paymentDescription = String(description || `ExpressWash Order ${order.tracking_code}`);

    const { data: payment, error: paymentCreateError } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        customer_id: order.customer_id,
        customer_name: profile.name ?? 'Customer',
        amount: paymentAmount,
        method: 'mpesa',
        status: 'processing',
        phone_number: formattedPhone,
        merchant_request_id: merchantReference,
        provider: provider.name,
        provider_reference: merchantReference,
        provider_status: 'initiated',
        reference_number: merchantReference,
        result_desc: 'Payment intent created',
        provider_metadata: {
          provider: provider.name,
          description: paymentDescription,
          orderTrackingCode: order.tracking_code,
        },
      })
      .select('id')
      .single();

    if (paymentCreateError || !payment) {
      logger.error('Failed to save payment intent', { error: paymentCreateError?.message });
      return jsonResponse({ success: false, error: 'Failed to create payment intent' }, 500);
    }

    try {
      const startResult = await provider.startPayment({
        amount: paymentAmount,
        merchantReference,
        description: paymentDescription,
        orderTrackingCode: order.tracking_code,
        customer: {
          name: profile.name,
          email: profile.email,
          phoneNumber: formattedPhone,
        },
      });

      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({
          checkout_request_id: startResult.providerPaymentId,
          merchant_request_id: startResult.providerReference,
          provider_payment_id: startResult.providerPaymentId,
          provider_reference: startResult.providerReference,
          provider_status: startResult.providerStatus,
          result_desc: startResult.customerMessage,
          updated_at: new Date().toISOString(),
          provider_metadata: {
            provider: startResult.provider,
            redirectUrl: startResult.redirectUrl,
            providerResponse: startResult.raw,
            description: paymentDescription,
            orderTrackingCode: order.tracking_code,
          },
        })
        .eq('id', payment.id);

      if (paymentUpdateError) {
        logger.error('Failed to update provider payment identifiers', {
          error: paymentUpdateError.message,
          paymentId: payment.id,
        });
      }

      return jsonResponse({
        success: true,
        provider: startResult.provider,
        checkoutRequestId: startResult.providerPaymentId,
        merchantRequestId: startResult.providerReference,
        redirectUrl: startResult.redirectUrl,
        message: startResult.customerMessage,
      });
    } catch (providerError) {
      const message = providerError instanceof Error ? providerError.message : 'Payment provider request failed';
      logger.error('Payment provider start failed', { error: message, paymentId: payment.id });

      await supabase
        .from('payments')
        .update({
          status: 'failed',
          provider_status: 'start_failed',
          result_desc: message,
          failure_reason: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      return jsonResponse({ success: false, error: message }, 502);
    }
  } catch (error) {
    logger.error('Payment start error', { error: error instanceof Error ? error.message : 'Unknown error' });

    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    }, 500);
  }
});
