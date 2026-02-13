/**
 * Payment type definitions for ExpressWash
 * Supports STK Push (M-Pesa), QR Code, and other payment methods
 */

export type PaymentMethod = 'mpesa' | 'cash' | 'card' | 'bank_transfer' | 'qr_code';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  phoneNumber?: string; // For M-Pesa
  transactionId?: string; // M-Pesa transaction ID
  merchantRequestId?: string; // STK Push merchant request ID
  checkoutRequestId?: string; // STK Push checkout request ID
  referenceNumber?: string; // Payment reference
  customerName?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
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
 * QR Code Request
 */
export interface QRCodeRequest {
  amount: number;
  accountReference: string; // Order ID
  transactionDesc: string;
  merchantName?: string;
}

/**
 * QR Code Response
 */
export interface QRCodeResponse {
  success: boolean;
  qrCode?: string; // Base64 encoded QR code image
  qrString?: string; // QR code string for manual generation
  referenceNumber?: string;
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
