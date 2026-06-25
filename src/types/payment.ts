/**
 * Payment type definitions for ExpressWash
 * Unified type supporting provider-backed order payments and manual invoice payments.
 */

export type PaymentMethod = 'mpesa' | 'cash' | 'card' | 'bank_transfer' | 'qr_code';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export interface Payment {
  id: string;
  orderId?: string;              // Provider-backed order payments
  invoiceId?: string;            // Manual / invoice-based payments
  invoiceNumber?: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  phoneNumber?: string;
  customerName?: string;
  recordedBy?: string;           // Who recorded the payment (manual/cash)
  provider?: string;
  providerPaymentId?: string;
  providerReference?: string;
  providerStatus?: string;
  payerPhoneNumber?: string;
  payerPhoneMatchesIntent?: boolean | null;
  payerPhoneMismatchAt?: string;
  merchantRequestId?: string;    // Legacy/provider merchant reference
  checkoutRequestId?: string;    // Legacy/provider checkout or tracking ID
  reference?: string;            // Manual payment reference
  referenceNumber?: string;      // System-generated reference
  mpesaReceiptNumber?: string;
  resultCode?: number;
  resultDesc?: string;
  failureReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

/**
 * Payment start request - sent to the provider-backed Edge Function.
 */
export interface STKPushRequest {
  phoneNumber: string; // Format: 254712345678 (without +)
  amount: number; // Amount to charge
  accountReference: string; // Order ID or reference
  transactionDesc: string; // Description shown to customer
  callbackUrl?: string; // Optional provider callback URL override
}

/**
 * Payment start response - from the provider-backed Edge Function.
 */
export interface STKPushResponse {
  success: boolean;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  responseCode?: string;
  responseDescription?: string;
  customerMessage?: string;
  provider?: string;
  redirectUrl?: string;
  idempotent?: boolean;
  errorMessage?: string;
}

/**
 * Payment Callback - received from provider after payment
 */
export interface PaymentCallback {
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: number; // 0 = success
  resultDesc: string;
  amount?: number;
  mpesaReceiptNumber?: string; // M-Pesa transaction ID
  transactionDate?: string;
  phoneNumber?: string;
}

/**
 * Payment Query Request - check payment status
 */
export interface PaymentQueryRequest {
  checkoutRequestId: string;
}

/**
 * Payment Query Response
 */
export interface PaymentQueryResponse {
  success: boolean;
  status: PaymentStatus;
  resultCode?: number;
  resultDesc?: string;
  amount?: number;
  mpesaReceiptNumber?: string;
  errorMessage?: string;
}

/**
 * Payment verification result
 */
export interface PaymentVerification {
  verified: boolean;
  payment?: Payment;
  message?: string;
}

/**
 * Payment statistics
 */
export interface PaymentStats {
  totalAmount: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  successRate: number; // Percentage
}
