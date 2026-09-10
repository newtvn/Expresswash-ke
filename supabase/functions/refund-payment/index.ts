import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from '../_shared/logger.ts';
import { getPaymentProvider } from '../_shared/paymentProviders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RefundRequestBody = {
  action?: 'request' | 'confirm-completed';
  paymentId?: string;
  amount?: number;
  reason?: string;
  idempotencyKey?: string;
  refundRequestId?: string;
  evidenceReference?: string;
};

type ProviderRefundRow = {
  id: string;
  payment_id: string;
  amount: number | string;
  currency: string;
  reason: string;
  status: string;
};

type PaymentRow = {
  id: string;
  amount: number | string;
  status: string;
  provider: string;
  provider_payment_id?: string | null;
  checkout_request_id?: string | null;
  mpesa_receipt_number?: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isCardMethod(method: string): boolean {
  return /visa|mastercard|amex|card/i.test(method);
}

function isMobileMethod(method: string): boolean {
  return /m-?pesa|mobile|airtel|mtn|tigo|wallet/i.test(method);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ success: false, error: 'Method not allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return jsonResponse({ success: false, error: 'Authentication required' }, 401);

  let reservedRequestId: string | undefined;
  let serviceClientForFailure: ReturnType<typeof createClient> | undefined;
  let providerSubmissionStarted = false;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    serviceClientForFailure = serviceClient;
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ success: false, error: 'Invalid session' }, 401);

    const body = await req.json() as RefundRequestBody;
    const action = body.action ?? 'request';

    if (action === 'confirm-completed') {
      if (!body.refundRequestId || !body.evidenceReference?.trim()) {
        return jsonResponse({ success: false, error: 'Refund request and completion evidence are required' }, 400);
      }
      const { data, error } = await userClient.rpc('complete_provider_refund_request', {
        p_request_id: body.refundRequestId,
        p_evidence_reference: body.evidenceReference.trim(),
      });
      if (error) return jsonResponse({ success: false, error: error.message }, 400);
      return jsonResponse(data as Record<string, unknown>);
    }

    if (!body.paymentId || !Number.isFinite(Number(body.amount)) || !body.reason?.trim() || !body.idempotencyKey?.trim()) {
      return jsonResponse({ success: false, error: 'Payment, amount, reason, and idempotency key are required' }, 400);
    }

    const amount = Math.round(Number(body.amount) * 100) / 100;
    const { data: prepared, error: prepareError } = await userClient.rpc('prepare_provider_refund_request', {
      p_payment_id: body.paymentId,
      p_amount: amount,
      p_reason: body.reason.trim(),
      p_idempotency_key: body.idempotencyKey.trim(),
    });
    if (prepareError) return jsonResponse({ success: false, error: prepareError.message }, 400);

    const preparedResult = prepared as { request_id?: string; status?: string; idempotent?: boolean };
    if (!preparedResult.request_id) return jsonResponse({ success: false, error: 'Failed to reserve refund request' }, 500);
    reservedRequestId = preparedResult.request_id;
    if (preparedResult.idempotent) {
      return jsonResponse({
        success: true,
        requestId: preparedResult.request_id,
        status: preparedResult.status,
        idempotent: true,
      });
    }

    const { data: requestData, error: requestError } = await userClient
      .from('provider_refund_requests')
      .select('id,payment_id,amount,currency,reason,status')
      .eq('id', preparedResult.request_id)
      .single();
    if (requestError || !requestData) throw new Error('Reserved refund request could not be loaded');
    const refundRequest = requestData as ProviderRefundRow;

    const { data: paymentData, error: paymentError } = await userClient
      .from('payments')
      .select('id,amount,status,provider,provider_payment_id,checkout_request_id,mpesa_receipt_number')
      .eq('id', refundRequest.payment_id)
      .single();
    if (paymentError || !paymentData) throw new Error('Source payment could not be loaded');
    const payment = paymentData as PaymentRow;

    const trackingId = payment.provider_payment_id || payment.checkout_request_id;
    if (!trackingId) throw new Error('Source payment is missing its PesaPal tracking ID');

    const provider = getPaymentProvider();
    const providerPayment = await provider.getPaymentStatus(trackingId);
    const providerAmount = Number(providerPayment.amount ?? payment.amount);
    const confirmationCode = providerPayment.confirmationCode || payment.mpesa_receipt_number;
    const paymentMethod = providerPayment.paymentMethod || '';
    const providerCurrency = (providerPayment.currency || refundRequest.currency).toUpperCase();

    const rejectRequest = async (message: string): Promise<Response> => {
      await serviceClient.rpc('mark_provider_refund_submission', {
        p_request_id: refundRequest.id,
        p_status: 'rejected',
        p_provider_message: message,
        p_confirmation_code: confirmationCode || null,
        p_payment_method: paymentMethod || null,
      });
      return jsonResponse({ success: false, requestId: refundRequest.id, status: 'rejected', error: message }, 400);
    };

    if (providerPayment.providerStatus !== 'completed') return await rejectRequest('PesaPal payment is not completed');
    if (!confirmationCode) return await rejectRequest('PesaPal payment is missing its confirmation code');
    if (providerCurrency !== refundRequest.currency.toUpperCase()) return await rejectRequest('Refund currency does not match the original payment');
    if (!Number.isFinite(providerAmount) || amount > providerAmount) return await rejectRequest('Refund amount exceeds the provider payment amount');
    if (isMobileMethod(paymentMethod) && Math.abs(amount - providerAmount) > 0.009) {
      return await rejectRequest('Mobile-money payments can only be refunded in full');
    }
    if (!isMobileMethod(paymentMethod) && !isCardMethod(paymentMethod)) {
      return await rejectRequest('Unsupported or unknown PesaPal payment method');
    }

    const { data: profile } = await userClient
      .from('profiles')
      .select('name,email')
      .eq('id', userData.user.id)
      .maybeSingle();
    const username = profile?.name || profile?.email || userData.user.email || userData.user.id;

    providerSubmissionStarted = true;
    const providerResult = await provider.requestRefund({
      confirmationCode,
      amount,
      username,
      remarks: refundRequest.reason,
    });

    const nextStatus = providerResult.accepted ? 'processing' : 'rejected';
    const { error: markError } = await serviceClient.rpc('mark_provider_refund_submission', {
      p_request_id: refundRequest.id,
      p_status: nextStatus,
      p_provider_message: providerResult.message,
      p_confirmation_code: confirmationCode,
      p_payment_method: paymentMethod,
    });
    if (markError) throw new Error('Provider response could not be persisted');

    logger.info('PesaPal refund request processed', {
      refundRequestId: refundRequest.id,
      paymentId: payment.id,
      accepted: providerResult.accepted,
    });

    return jsonResponse({
      success: providerResult.accepted,
      requestId: refundRequest.id,
      status: nextStatus,
      message: providerResult.message,
    }, providerResult.accepted ? 202 : 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refund request failed';
    logger.error('Provider refund request failed', { error: message });

    if (reservedRequestId && serviceClientForFailure) {
      await serviceClientForFailure.rpc('mark_provider_refund_submission', {
        p_request_id: reservedRequestId,
        p_status: providerSubmissionStarted ? 'processing' : 'failed_retryable',
        p_provider_message: providerSubmissionStarted
          ? `Provider outcome unknown; reconcile before any further action. ${message}`
          : message,
      });
    }
    return jsonResponse({ success: false, error: message }, 400);
  }
});
