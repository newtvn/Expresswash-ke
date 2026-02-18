/**
 * Checkout Example Component
 * Complete example showing how to integrate payment system
 *
 * Copy this code to your actual checkout page and customize as needed
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { PaymentModal } from './PaymentModal';
import type { PaymentMethod } from '@/types/payment';
import type { Order } from '@/types/order';

interface CheckoutExampleProps {
  order: Order; // The order being paid for
  onOrderComplete?: (orderId: string) => void;
}

export function CheckoutExample({ order, onOrderComplete }: CheckoutExampleProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);

  /**
   * Handle payment initiation
   */
  const handlePayment = async () => {
    // Validate inputs
    if (paymentMethod === 'mpesa' && !phoneNumber) {
      toast({
        title: 'Phone Number Required',
        description: 'Please enter your M-Pesa phone number',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      if (paymentMethod === 'mpesa') {
        // Initiate STK Push
        await initiateSTKPush();
      } else if (paymentMethod === 'cash') {
        // Cash on delivery - just complete order
        await completeCashOrder();
      } else {
        toast({
          title: 'Payment Method Not Available',
          description: 'This payment method is coming soon',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Payment Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Initiate STK Push payment
   */
  const initiateSTKPush = async () => {
    try {
      // Call Supabase Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stk-push`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            phoneNumber: phoneNumber,
            amount: order.total,
            orderId: order.id,
            description: `Payment for Order #${order.trackingCode}`,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'STK Push failed');
      }

      // Show payment modal
      setCheckoutRequestId(data.checkoutRequestId);
      setShowPaymentModal(true);

      toast({
        title: 'Payment Request Sent',
        description: 'Check your phone for the M-Pesa prompt',
      });
    } catch (error: unknown) {
      console.error('STK Push error:', error);
      toast({
        title: 'Payment Failed',
        description: error instanceof Error ? error.message : 'Failed to initiate payment',
        variant: 'destructive',
      });
      throw error;
    }
  };

  /**
   * Complete order with cash on delivery
   */
  const completeCashOrder = async () => {
    try {
      // Update order payment method
      // In real implementation, call your order service
      toast({
        title: 'Order Placed!',
        description: 'Your order has been confirmed. Pay on delivery.',
      });

      // Navigate to order confirmation
      onOrderComplete?.(order.id!);
      navigate(`/customer/orders/${order.id}`);
    } catch (error) {
      console.error('Order completion error:', error);
      throw error;
    }
  };

  /**
   * Handle successful payment
   */
  const handlePaymentSuccess = (transactionId: string) => {
    toast({
      title: 'Payment Successful! 🎉',
      description: `Transaction ID: ${transactionId}`,
    });

    // Wait a bit for UI feedback, then navigate
    setTimeout(() => {
      setShowPaymentModal(false);
      onOrderComplete?.(order.id!);
      navigate(`/customer/orders/${order.id}`);
    }, 2000);
  };

  /**
   * Handle failed payment
   */
  const handlePaymentFailure = (reason: string) => {
    toast({
      title: 'Payment Failed',
      description: reason,
      variant: 'destructive',
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
          <CardDescription>Review your order before payment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Order Items */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-gray-700">Items ({order.items.length})</h3>
            <div className="space-y-2">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="font-medium">
                    KES {(item.totalPrice || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">KES {order.subtotal?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Delivery Fee ({order.zone})</span>
              <span className="font-medium">KES {order.deliveryFee?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">VAT (16%)</span>
              <span className="font-medium">KES {order.vat?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total</span>
              <span>KES {order.total?.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
          <CardDescription>Choose how you want to pay</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            phoneNumber={phoneNumber}
            onPhoneNumberChange={setPhoneNumber}
            amount={order.total || 0}
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="flex-1"
          disabled={isProcessing}
        >
          Back
        </Button>
        <Button
          onClick={handlePayment}
          className="flex-1"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Processing...
            </>
          ) : paymentMethod === 'mpesa' ? (
            `Pay KES ${order.total?.toLocaleString()}`
          ) : (
            'Place Order'
          )}
        </Button>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        checkoutRequestId={checkoutRequestId}
        phoneNumber={phoneNumber}
        amount={order.total || 0}
        onSuccess={handlePaymentSuccess}
        onFailure={handlePaymentFailure}
      />
    </div>
  );
}

/**
 * Usage Example:
 *
 * import { CheckoutExample } from '@/components/payment/CheckoutExample';
 *
 * function CheckoutPage() {
 *   const { orderId } = useParams();
 *   const [order, setOrder] = useState<Order | null>(null);
 *
 *   useEffect(() => {
 *     // Load order data
 *     loadOrder(orderId).then(setOrder);
 *   }, [orderId]);
 *
 *   if (!order) return <div>Loading...</div>;
 *
 *   return (
 *     <CheckoutExample
 *       order={order}
 *       onOrderComplete={(id) => {
 *         console.log('Order completed:', id);
 *       }}
 *     />
 *   );
 * }
 */
