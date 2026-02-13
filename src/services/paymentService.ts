/**
 * Payment Service for ExpressWash
 * Handles STK Push, QR Codes, and payment verification
 *
 * IMPORTANT: This service contains sensitive operations.
 * API credentials should NEVER be exposed in frontend code.
 *
 * For production, create a backend API (Node.js/Supabase Edge Functions)
 * that handles authentication and calls the bank API securely.
 */

import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';
import type {
  Payment,
  STKPushRequest,
  STKPushResponse,
  PaymentQueryRequest,
  PaymentQueryResponse,
  QRCodeRequest,
  QRCodeResponse,
  PaymentCallback,
  PaymentVerification,
  PaymentStatus,
} from '@/types/payment';

// ============================================================
// CONFIGURATION
// ============================================================

const BANK_API_BASE_URL = import.meta.env.VITE_BANK_API_URL || 'https://api.creditbank.co.ke';
const BANK_CONSUMER_KEY = import.meta.env.VITE_BANK_CONSUMER_KEY;
const BANK_CONSUMER_SECRET = import.meta.env.VITE_BANK_CONSUMER_SECRET;
const BANK_ACCOUNT_NUMBER = import.meta.env.VITE_BANK_ACCOUNT_NUMBER;

// Callback URL for payment confirmations (your backend endpoint)
const PAYMENT_CALLBACK_URL = import.meta.env.VITE_PAYMENT_CALLBACK_URL || 'https://your-backend.com/api/payment/callback';

// ============================================================
// SECURITY WARNING
// ============================================================
// 🚨 NEVER put real API credentials in frontend environment variables!
// 🚨 This is for demonstration only. Production must use backend API.
// ============================================================

/**
 * Get access token from bank API
 * 🔒 SHOULD BE DONE ON BACKEND SERVER, NOT FRONTEND!
 */
async function getBankAccessToken(): Promise<string | null> {
  // WARNING: In production, call your backend endpoint that securely handles this
  // Example: const response = await fetch('/api/payment/token');

  try {
    const credentials = btoa(`${BANK_CONSUMER_KEY}:${BANK_CONSUMER_SECRET}`);

    const response = await fetch(`${BANK_API_BASE_URL}/oauth/token`, {
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
      console.error('Failed to get access token:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

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
 * 🔒 In production, this MUST be called from your backend API
 *
 * @param request - STK Push request details
 * @returns Response with checkout request ID
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

    // 🚨 PRODUCTION: Replace this with a call to your backend
    // const response = await fetch('/api/payment/stk-push', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(request),
    // });

    // Get access token
    const accessToken = await getBankAccessToken();
    if (!accessToken) {
      return {
        success: false,
        errorMessage: 'Failed to authenticate with payment provider',
      };
    }

    // Call Credit Bank STK Push API
    // NOTE: For production, use Supabase Edge Function instead (see supabase/functions/stk-push)
    const response = await fetch(`${BANK_API_BASE_URL}/safaricom-stkpush`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        amount: request.amount.toString(),
        reference: request.accountReference,
        countryCode: 'KE',
        narration: request.transactionDesc,
        callbackUrl: request.callbackUrl || PAYMENT_CALLBACK_URL,
        errorCallbackUrl: request.callbackUrl || PAYMENT_CALLBACK_URL,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        errorMessage: errorData.message || `Payment request failed: ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Store payment record in database
    await createPaymentRecord({
      orderId: request.accountReference,
      amount: request.amount,
      method: 'mpesa',
      phoneNumber: phoneNumber,
      merchantRequestId: data.merchantRequestId,
      checkoutRequestId: data.checkoutRequestId,
      status: 'processing',
    });

    return {
      success: true,
      merchantRequestId: data.merchantRequestId,
      checkoutRequestId: data.checkoutRequestId,
      responseCode: data.responseCode,
      responseDescription: data.responseDescription,
      customerMessage: data.customerMessage || 'Please check your phone and enter your M-Pesa PIN',
    };
  } catch (error) {
    console.error('STK Push error:', error);
    return {
      success: false,
      errorMessage: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Query STK Push payment status
 * 🔒 Should be called from backend in production
 */
export async function queryPaymentStatus(request: PaymentQueryRequest): Promise<PaymentQueryResponse> {
  try {
    // 🚨 PRODUCTION: Call your backend
    // const response = await fetch(`/api/payment/query/${request.checkoutRequestId}`);

    const accessToken = await getBankAccessToken();
    if (!accessToken) {
      return {
        success: false,
        status: 'failed',
        errorMessage: 'Failed to authenticate',
      };
    }

    const response = await fetch(`${BANK_API_BASE_URL}/v1/payment/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        checkoutRequestId: request.checkoutRequestId,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        status: 'failed',
        errorMessage: 'Failed to query payment status',
      };
    }

    const data = await response.json();

    // Map result code to payment status
    let status: PaymentStatus = 'pending';
    if (data.resultCode === 0) {
      status = 'completed';
    } else if (data.resultCode === 1032 || data.resultCode === 1037) {
      status = 'cancelled'; // User cancelled
    } else if (data.resultCode) {
      status = 'failed';
    }

    // Update payment record
    if (status === 'completed' && data.mpesaReceiptNumber) {
      await updatePaymentRecord(request.checkoutRequestId, {
        status,
        transactionId: data.mpesaReceiptNumber,
        completedAt: new Date().toISOString(),
      });
    }

    return {
      success: data.resultCode === 0,
      status,
      resultCode: data.resultCode,
      resultDesc: data.resultDesc,
      amount: data.amount,
      mpesaReceiptNumber: data.mpesaReceiptNumber,
    };
  } catch (error) {
    console.error('Payment query error:', error);
    return {
      success: false,
      status: 'failed',
      errorMessage: 'Failed to check payment status',
    };
  }
}

// ============================================================
// QR CODE PAYMENT
// ============================================================

/**
 * Generate M-Pesa QR Code for payment
 * Customer scans with M-Pesa app to pay
 */
export async function generateQRCode(request: QRCodeRequest): Promise<QRCodeResponse> {
  try {
    // 🚨 PRODUCTION: Call your backend
    // const response = await fetch('/api/payment/qr-code', { ... });

    const accessToken = await getBankAccessToken();
    if (!accessToken) {
      return {
        success: false,
        errorMessage: 'Failed to authenticate',
      };
    }

    const response = await fetch(`${BANK_API_BASE_URL}/v1/payment/qr-code`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: request.amount.toFixed(2),
        accountReference: request.accountReference,
        transactionDesc: request.transactionDesc,
        merchantName: request.merchantName || 'ExpressWash',
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        errorMessage: 'Failed to generate QR code',
      };
    }

    const data = await response.json();

    return {
      success: true,
      qrCode: data.qrCode, // Base64 image
      qrString: data.qrString,
      referenceNumber: data.referenceNumber,
    };
  } catch (error) {
    console.error('QR Code generation error:', error);
    return {
      success: false,
      errorMessage: 'Failed to generate QR code',
    };
  }
}

// ============================================================
// DATABASE OPERATIONS
// ============================================================

/**
 * Create payment record in database
 */
async function createPaymentRecord(payment: Partial<Payment>): Promise<void> {
  await supabase.from('payments').insert({
    order_id: payment.orderId,
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    phone_number: payment.phoneNumber,
    merchant_request_id: payment.merchantRequestId,
    checkout_request_id: payment.checkoutRequestId,
    created_at: new Date().toISOString(),
  });
}

/**
 * Update payment record
 */
async function updatePaymentRecord(checkoutRequestId: string, updates: Partial<Payment>): Promise<void> {
  await supabase
    .from('payments')
    .update({
      status: updates.status,
      transaction_id: updates.transactionId,
      completed_at: updates.completedAt,
      failure_reason: updates.failureReason,
      updated_at: new Date().toISOString(),
    })
    .eq('checkout_request_id', checkoutRequestId);
}

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

  if (payment.status === 'processing') {
    // Check current status
    const statusQuery = await queryPaymentStatus({
      checkoutRequestId: payment.checkoutRequestId!,
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
 * Handle payment callback from bank (webhook)
 * This should be called from your backend when bank sends confirmation
 */
export async function handlePaymentCallback(callback: PaymentCallback): Promise<void> {
  const status: PaymentStatus = callback.resultCode === 0 ? 'completed' : 'failed';

  await updatePaymentRecord(callback.checkoutRequestId, {
    status,
    transactionId: callback.mpesaReceiptNumber,
    completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    failureReason: status === 'failed' ? callback.resultDesc : undefined,
  });

  // If payment successful, update order status
  if (status === 'completed') {
    const payment = await getPaymentByCheckoutRequestId(callback.checkoutRequestId);
    if (payment) {
      await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', payment.orderId);
    }
  }
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
function mapDatabaseToPayment(data: any): Payment {
  return {
    id: data.id,
    orderId: data.order_id,
    amount: data.amount,
    method: data.method,
    status: data.status,
    phoneNumber: data.phone_number,
    transactionId: data.transaction_id,
    merchantRequestId: data.merchant_request_id,
    checkoutRequestId: data.checkout_request_id,
    referenceNumber: data.reference_number,
    customerName: data.customer_name,
    failureReason: data.failure_reason,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    completedAt: data.completed_at,
  };
}
