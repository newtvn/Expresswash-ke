/**
 * Custom React hook for payment operations
 * Simplifies STK Push and payment verification in components
 */

import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  initiateSTKPush,
  queryPaymentStatus,
  verifyPayment,
  getPaymentByOrderId,
  formatPhoneNumber,
  isValidPhoneNumber,
} from '@/services/paymentService';
import type {
  STKPushRequest,
  STKPushResponse,
  PaymentQueryRequest,
} from '@/types/payment';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook for initiating STK Push payments
 */
export function useSTKPush() {
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (request: STKPushRequest) => {
      return initiateSTKPush(request);
    },
    onSuccess: (response: STKPushResponse) => {
      if (response.success) {
        toast({
          title: 'Payment Request Sent',
          description: response.customerMessage || 'Check your phone for M-Pesa prompt',
        });
      } else {
        toast({
          title: 'Payment Failed',
          description: response.errorMessage,
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to initiate payment. Please try again.',
        variant: 'destructive',
      });
    },
  });

  return {
    initiatePayment: mutation.mutate,
    isLoading: mutation.isPending,
    response: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for checking payment status
 */
export function usePaymentStatus(checkoutRequestId: string | null, options?: {
  enabled?: boolean;
  refetchInterval?: number;
}) {
  return useQuery({
    queryKey: ['payment-status', checkoutRequestId],
    queryFn: async () => {
      if (!checkoutRequestId) return null;
      return queryPaymentStatus({ checkoutRequestId });
    },
    enabled: !!checkoutRequestId && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval || 5000, // Poll every 5 seconds
    refetchIntervalInBackground: false,
  });
}

/**
 * Hook for verifying payment completion
 */
export function usePaymentVerification(orderId: string | null) {
  return useQuery({
    queryKey: ['payment-verification', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      return verifyPayment(orderId);
    },
    enabled: !!orderId,
  });
}

/**
 * Hook for getting order payment details
 */
export function useOrderPayment(orderId: string | null) {
  return useQuery({
    queryKey: ['order-payment', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      return getPaymentByOrderId(orderId);
    },
    enabled: !!orderId,
  });
}

/**
 * Comprehensive payment hook with all operations
 */
export function usePayment() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const stkPush = useSTKPush();
  const paymentStatus = usePaymentStatus(checkoutRequestId, {
    enabled: isPolling,
    refetchInterval: 5000,
  });

  /**
   * Initiate payment and start polling for status
   */
  const initiatePayment = useCallback(
    async (request: STKPushRequest) => {
      // Validate phone number
      if (!isValidPhoneNumber(request.phoneNumber)) {
        return {
          success: false,
          errorMessage: 'Invalid phone number format',
        };
      }

      // Initiate STK Push
      const response = await new Promise<STKPushResponse>((resolve) => {
        stkPush.initiatePayment(request, {
          onSuccess: resolve,
          onError: () => resolve({ success: false, errorMessage: 'Payment initiation failed' }),
        });
      });

      if (response.success && response.checkoutRequestId) {
        setCheckoutRequestId(response.checkoutRequestId);
        setIsPolling(true);
      }

      return response;
    },
    [stkPush]
  );

  /**
   * Stop polling for payment status
   */
  const stopPolling = useCallback(() => {
    setIsPolling(false);
    setCheckoutRequestId(null);
  }, []);

  /**
   * Reset payment state
   */
  const reset = useCallback(() => {
    setPhoneNumber('');
    setAmount(0);
    setCheckoutRequestId(null);
    setIsPolling(false);
    stkPush.reset();
  }, [stkPush]);

  return {
    // State
    phoneNumber,
    setPhoneNumber,
    amount,
    setAmount,
    checkoutRequestId,
    isPolling,

    // Actions
    initiatePayment,
    stopPolling,
    reset,

    // Data
    paymentStatus: paymentStatus.data,
    isLoading: stkPush.isLoading,
    error: stkPush.error,

    // Helpers
    formatPhoneNumber,
    isValidPhoneNumber,
  };
}
