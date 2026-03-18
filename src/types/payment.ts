/**
 * Payment type definitions for ExpressWash
 * Unified type supporting both STK Push (order-based) and manual (invoice-based) payments
 */

export type PaymentMethod = 'mpesa' | 'cash' | 'card' | 'bank_transfer' | 'qr_code';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export interface Payment {
  id: string;
  orderId?: string;              // STK Push / order-based payments
  invoiceId?: string;            // Manual / invoice-based payments
  invoiceNumber?: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  phoneNumber?: string;
  customerName?: string;
  recordedBy?: string;           // Who recorded the payment (manual/cash)
  merchantRequestId?: string;    // STK Push merchant request ID
  checkoutRequestId?: string;    // STK Push checkout request ID
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
 * STK Push Request - sent to bank/M-Pesa API
 */
export interface STKPushRequest {
  phoneNumber: string; // Format: 254712345678 (without +)
  amount: number; // Amount to charge
  accountReference: string; // Order ID or reference
  transactionDesc: string; // Description shown to customer
  callbackUrl?: string; // URL to receive payment confirmation
}

/**
 * STK Push Response - from bank/M-Pesa API
 */
export interface STKPushResponse {
  success: boolean;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  responseCode?: string;
  responseDescription?: string;
  customerMessage?: string;
  errorMessage?: string;
}

/**
 * Payment Callback - received from bank after payment
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
