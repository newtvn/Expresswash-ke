/**
 * Payment Service for ExpressWash
 * Handles STK Push, QR Codes, and payment verification
 *
 * All sensitive bank API calls are routed through Supabase Edge Functions.
 * No bank credentials are used in frontend code.
 */

import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';
import type {
  Payment,
  STKPushRequest,
  STKPushResponse,
  PaymentQueryRequest,
  PaymentQueryResponse,
  PaymentVerification,
  PaymentStatus,
} from '@/types/payment';

// ============================================================
// PHONE NUMBER UTILITIES
// ============================================================

/**
 * Format phone number for M-Pesa (254XXXXXXXXX)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove spaces, dashes, and plus sign
  let cleaned = phone.replace(/[\s\-+]/g, '');

  // If starts with 0, replace with 254
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  }

  // If starts with 7 or 1, add 254
  if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    cleaned = '254' + cleaned;
  }

  return cleaned;
}

/**
 * Validate phone number (Safaricom format)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  // Safaricom numbers: 254-7XX-XXX-XXX or 254-1XX-XXX-XXX
  return /^254[71]\d{8}$/.test(formatted);
}

// ============================================================
// STK PUSH (M-PESA PAYMENT PROMPT)
// ============================================================

/**
 * Initiate STK Push - Prompts customer to pay via M-Pesa
 * Calls the stk-push Edge Function which securely handles bank API credentials.
 */
export async function initiateSTKPush(request: STKPushRequest): Promise<STKPushResponse> {
  try {
    // Validate phone number
    const phoneNumber = formatPhoneNumber(request.phoneNumber);
    if (!isValidPhoneNumber(phoneNumber)) {
      return {
        success: false,
        errorMessage: 'Invalid phone number. Use format: 0712345678 or +254712345678',
      };
    }

    // Validate amount
    if (request.amount < 10) {
      return {
        success: false,
        errorMessage: 'Minimum payment amount is KES 10',
      };
    }

    // Call stk-push Edge Function (handles bank auth + API call securely)
    const { data, error } = await supabase.functions.invoke('stk-push', {
      body: {
        phoneNumber,
        amount: request.amount,
        orderId: request.accountReference,
        description: request.transactionDesc,
      },
    });

    if (error) {
      return {
        success: false,
        errorMessage: error.message || 'Failed to initiate payment',
      };
    }

    if (!data?.success) {
      return {
        success: false,
        errorMessage: data?.error || 'Payment request failed',
      };
    }

    return {
      success: true,
      merchantRequestId: data.merchantRequestId,
      checkoutRequestId: data.checkoutRequestId,
      customerMessage: data.message || 'Please check your phone and enter your M-Pesa PIN',
    };
  } catch {
    return {
      success: false,
      errorMessage: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Query STK Push payment status
 * Checks payment record in database. If still processing, the payment-callback
 * Edge Function will update it when the bank sends confirmation.
 */
export async function queryPaymentStatus(request: PaymentQueryRequest): Promise<PaymentQueryResponse> {
  try {
    const { data, error } = await retrySupabaseQuery(
      () => supabase
        .from('payments')
        .select('status, mpesa_receipt_number, amount, result_code, result_desc')
        .eq('checkout_request_id', request.checkoutRequestId)
        .single(),
      { maxRetries: 2 },
    );

    if (error || !data) {
      return {
        success: false,
        status: 'failed',
        errorMessage: 'Payment record not found',
      };
    }

    const status = data.status as PaymentStatus;

    return {
      success: status === 'completed',
      status,
      resultCode: data.result_code as number | undefined,
      resultDesc: data.result_desc as string | undefined,
      amount: data.amount as number | undefined,
      mpesaReceiptNumber: data.mpesa_receipt_number as string | undefined,
    };
  } catch {
    return {
      success: false,
      status: 'failed',
      errorMessage: 'Failed to check payment status',
    };
  }
}

// ============================================================
// DATABASE READ OPERATIONS
// ============================================================

/**
 * Get payment by order ID
 */
export async function getPaymentByOrderId(orderId: string): Promise<Payment | null> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    { maxRetries: 2 }
  );

  if (error || !data) {
    return null;
  }

  return mapDatabaseToPayment(data);
}

/**
 * Get payment by checkout request ID
 */
export async function getPaymentByCheckoutRequestId(checkoutRequestId: string): Promise<Payment | null> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase
      .from('payments')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single(),
    { maxRetries: 2 }
  );

  if (error || !data) {
    return null;
  }

  return mapDatabaseToPayment(data);
}

/**
 * Verify payment completion
 */
export async function verifyPayment(orderId: string): Promise<PaymentVerification> {
  const payment = await getPaymentByOrderId(orderId);

  if (!payment) {
    return {
      verified: false,
      message: 'Payment not found',
    };
  }

  if (payment.status === 'completed') {
    return {
      verified: true,
      payment,
      message: 'Payment verified successfully',
    };
  }

  if (payment.status === 'processing' && payment.checkoutRequestId) {
    // Check current status from DB (callback may have updated it)
    const statusQuery = await queryPaymentStatus({
      checkoutRequestId: payment.checkoutRequestId,
    });

    if (statusQuery.success && statusQuery.status === 'completed') {
      const updatedPayment = await getPaymentByOrderId(orderId);
      return {
        verified: true,
        payment: updatedPayment || payment,
        message: 'Payment verified successfully',
      };
    }
  }

  return {
    verified: false,
    payment,
    message: `Payment is ${payment.status}`,
  };
}

/**
 * Get all payments for an order (including refunds)
 */
export async function getOrderPayments(orderId: string): Promise<Payment[]> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
    { maxRetries: 2 }
  );

  if (error || !data) {
    return [];
  }

  return data.map(mapDatabaseToPayment);
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Map database record to Payment type
 */
function mapDatabaseToPayment(data: Record<string, unknown>): Payment {
  return {
    id: data.id as string,
    orderId: (data.order_id as string) ?? undefined,
    invoiceId: (data.invoice_id as string) ?? undefined,
    invoiceNumber: (data.invoice_number as string) ?? undefined,
    amount: data.amount as number,
    method: data.method as Payment['method'],
    status: data.status as Payment['status'],
    phoneNumber: (data.phone_number as string) ?? undefined,
    customerName: (data.customer_name as string) ?? undefined,
    recordedBy: (data.recorded_by as string) ?? undefined,
    merchantRequestId: (data.merchant_request_id as string) ?? undefined,
    checkoutRequestId: (data.checkout_request_id as string) ?? undefined,
    reference: (data.reference as string) ?? undefined,
    referenceNumber: (data.reference_number as string) ?? undefined,
    mpesaReceiptNumber: (data.mpesa_receipt_number as string) ?? undefined,
    resultCode: (data.result_code as number) ?? undefined,
    resultDesc: (data.result_desc as string) ?? undefined,
    failureReason: (data.failure_reason as string) ?? undefined,
    notes: (data.notes as string) ?? undefined,
    createdAt: data.created_at as string,
    updatedAt: (data.updated_at as string) ?? undefined,
    completedAt: (data.completed_at as string) ?? undefined,
  };
}
