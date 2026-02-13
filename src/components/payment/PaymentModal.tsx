/**
 * Payment Modal Component
 * Shows STK Push payment status and polling
 */

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Smartphone, AlertCircle } from 'lucide-react';
import { usePaymentStatus } from '@/hooks/usePayment';
import type { PaymentStatus } from '@/types/payment';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkoutRequestId: string | null;
  phoneNumber?: string;
  amount: number;
  onSuccess?: (transactionId: string) => void;
  onFailure?: (reason: string) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  checkoutRequestId,
  phoneNumber,
  amount,
  onSuccess,
  onFailure,
}: PaymentModalProps) {
  const [status, setStatus] = useState<PaymentStatus>('processing');
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Poll payment status every 5 seconds
  const { data: paymentStatus, isLoading } = usePaymentStatus(checkoutRequestId, {
    enabled: isOpen && !!checkoutRequestId,
    refetchInterval: 5000,
  });

  // Update status when payment status changes
  useEffect(() => {
    if (paymentStatus?.status) {
      setStatus(paymentStatus.status);

      if (paymentStatus.status === 'completed') {
        onSuccess?.(paymentStatus.mpesaReceiptNumber || '');
      } else if (paymentStatus.status === 'failed' || paymentStatus.status === 'cancelled') {
        onFailure?.(paymentStatus.resultDesc || 'Payment failed');
      }
    }
  }, [paymentStatus, onSuccess, onFailure]);

  // Timer for timeout (2 minutes)
  useEffect(() => {
    if (!isOpen || status !== 'processing') return;

    const interval = setInterval(() => {
      setSecondsElapsed((prev) => {
        const newValue = prev + 1;

        // Auto-timeout after 120 seconds
        if (newValue >= 120) {
          setStatus('failed');
          onFailure?.('Payment timeout - please try again');
          clearInterval(interval);
        }

        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, status, onFailure]);

  // Reset timer when modal opens
  useEffect(() => {
    if (isOpen) {
      setSecondsElapsed(0);
      setStatus('processing');
    }
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusContent = () => {
    switch (status) {
      case 'processing':
        return {
          icon: <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />,
          title: 'Waiting for Payment',
          description: (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <Smartphone className="w-5 h-5" />
                <span className="font-medium">Check your phone for M-Pesa prompt</span>
              </div>
              {phoneNumber && (
                <p className="text-sm text-gray-600">
                  A payment request has been sent to <strong>{phoneNumber}</strong>
                </p>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="font-medium text-blue-900 mb-2">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Open the M-Pesa prompt on your phone</li>
                  <li>Enter your M-Pesa PIN</li>
                  <li>Confirm the payment of <strong>KES {amount.toLocaleString()}</strong></li>
                </ol>
              </div>
              <p className="text-xs text-gray-500">
                Time elapsed: {formatTime(secondsElapsed)} / 2:00
              </p>
            </div>
          ),
          actions: (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          ),
        };

      case 'completed':
        return {
          icon: <CheckCircle2 className="w-16 h-16 text-green-500" />,
          title: 'Payment Successful!',
          description: (
            <div className="space-y-3">
              <p className="text-gray-600">
                Your payment of <strong>KES {amount.toLocaleString()}</strong> has been received.
              </p>
              {paymentStatus?.mpesaReceiptNumber && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-900">
                    Transaction ID: <strong>{paymentStatus.mpesaReceiptNumber}</strong>
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-500">
                A confirmation SMS has been sent to your phone.
              </p>
            </div>
          ),
          actions: (
            <Button onClick={onClose} className="w-full">
              Continue
            </Button>
          ),
        };

      case 'failed':
        return {
          icon: <XCircle className="w-16 h-16 text-red-500" />,
          title: 'Payment Failed',
          description: (
            <div className="space-y-3">
              <p className="text-gray-600">
                {paymentStatus?.resultDesc || 'Unable to process your payment. Please try again.'}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-900">
                <p className="font-medium mb-1">Common reasons:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Insufficient M-Pesa balance</li>
                  <li>Incorrect PIN entered</li>
                  <li>Request timeout</li>
                </ul>
              </div>
            </div>
          ),
          actions: (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={() => window.location.reload()} className="flex-1">
                Try Again
              </Button>
            </div>
          ),
        };

      case 'cancelled':
        return {
          icon: <AlertCircle className="w-16 h-16 text-orange-500" />,
          title: 'Payment Cancelled',
          description: (
            <p className="text-gray-600">
              You cancelled the payment request. You can try again when ready.
            </p>
          ),
          actions: (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Close
              </Button>
              <Button onClick={() => window.location.reload()} className="flex-1">
                Try Again
              </Button>
            </div>
          ),
        };

      default:
        return {
          icon: <Loader2 className="w-16 h-16 text-gray-400 animate-spin" />,
          title: 'Processing...',
          description: <p className="text-gray-600">Please wait...</p>,
          actions: null,
        };
    }
  };

  const content = getStatusContent();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{content.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Payment status: {status}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-6 py-6">
          {/* Status Icon */}
          <div className="flex items-center justify-center">
            {content.icon}
          </div>

          {/* Status Description */}
          <div className="text-center w-full">
            {content.description}
          </div>

          {/* Actions */}
          {content.actions && (
            <div className="w-full pt-4">
              {content.actions}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
