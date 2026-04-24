import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { PageHeader, StatusBadge, ConfirmDialog } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROUTES } from '@/config/routes';
import { getOrderById, getOrderByUUID, cancelOrder, updateOrderStatus } from '@/services/orderService';
import { initiateSTKPush, isValidPhoneNumber, formatPhoneNumber, verifyPayment, getPaymentByOrderId } from '@/services/paymentService';
import { ORDER_STAGES } from '@/config/constants';
import { Order } from '@/types';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Package,
  Truck,
  Phone,
  User,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  Loader2,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';

const statusToLabel = (status: number): string => {
  if (status === 13) return 'Cancelled';
  if (status === 14) return 'Refunded';
  const stage = ORDER_STAGES.find((s) => s.id === status);
  return stage?.name ?? 'Unknown';
};

const isCancelledOrRefunded = (status: number) => status === 13 || status === 14;

// Valid status transitions matching the DB trigger
const VALID_TRANSITIONS: Record<number, number[]> = {
  1: [2, 13],
  2: [3, 13],
  3: [4, 13],
  4: [5, 13],
  5: [6],
  6: [7],
  7: [8],
  8: [9, 6],
  9: [10],
  10: [11],
  11: [12],
  12: [14],
  13: [],
  14: [],
};

const getNextStatusLabel = (status: number): string => {
  const labels: Record<number, string> = {
    2: 'Confirm Quote',
    3: 'Accept Quote',
    4: 'Schedule Pickup',
    5: 'Mark Picked Up',
    6: 'Start Processing',
    7: 'Move to Drying',
    8: 'Send to QC',
    9: 'Approve QC',
    10: 'Dispatch',
    11: 'Out for Delivery',
    12: 'Mark Delivered',
    13: 'Cancel Order',
    14: 'Issue Refund',
  };
  return labels[status] ?? `Move to ${statusToLabel(status)}`;
};

const buildTimeline = (currentStatus: number) => {
  return ORDER_STAGES.map((stage) => {
    const Icon = stage.icon;
    // For cancelled/refunded orders, don't mark any stage as completed
    const completed = isCancelledOrRefunded(currentStatus) ? false : currentStatus >= stage.id;
    const isCurrent = isCancelledOrRefunded(currentStatus) ? false : currentStatus === stage.id;
    return {
      id: stage.id,
      label: stage.name,
      description: stage.description,
      icon: Icon,
      completed,
      isCurrent,
    };
  });
};

export const OrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminView = location.pathname.startsWith('/admin');
  const backRoute = isAdminView ? ROUTES.ADMIN_ORDERS : ROUTES.CUSTOMER_ORDERS;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  // Payment state
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSent, setPaymentSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchOrder = async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const result = await getOrderById(id);
        if (!cancelled && result) {
          setOrder(result);
          if (result.id) {
            const payment = await getPaymentByOrderId(result.id);
            if (!cancelled && payment?.status === 'completed') {
              setPaymentComplete(true);
              // If payment was completed but order status wasn't advanced, advance it now
              if (result.status === 2) {
                const updated = await updateOrderStatus(result.trackingCode, 3);
                if (!cancelled && updated.order) setOrder(updated.order);
              }
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchOrder(true);
    const interval = setInterval(() => fetchOrder(false), 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [id]);

  const handleCancel = async () => {
    if (!order) return;
    setCancelling(true);
    const result = await cancelOrder(order.trackingCode);
    setCancelling(false);
    setCancelOpen(false);
    if (result.success) {
      toast.success('Order cancelled successfully');
      const updated = await getOrderByUUID(order.id);
      if (updated) setOrder(updated);
    } else {
      toast.error(result.message);
    }
  };

  const handlePayNow = async () => {
    if (!order) return;

    if (!isValidPhoneNumber(phoneNumber)) {
      toast.error('Invalid phone number', {
        description: 'Enter a valid Safaricom number (e.g. 0712345678)',
      });
      return;
    }

    setPaymentLoading(true);
    const result = await initiateSTKPush({
      phoneNumber: formatPhoneNumber(phoneNumber),
      amount: import.meta.env.DEV ? 10 : (order.total ?? 0),
      accountReference: order.id,
      transactionDesc: `Payment for ${order.trackingCode}`,
    });
    setPaymentLoading(false);

    if (result.success) {
      setPaymentSent(true);
      toast.success('Payment prompt sent!', {
        description: result.customerMessage ?? 'Check your phone and enter your M-Pesa PIN',
      });
    } else {
      toast.error('Payment failed', {
        description: result.errorMessage,
      });
    }
  };

  const handleVerifyPayment = async () => {
    if (!order?.id) return;
    setVerifying(true);
    const result = await verifyPayment(order.id);
    setVerifying(false);

    if (result.verified) {
      toast.success('Payment verified!');
      setPaymentComplete(true);
      setPayDialogOpen(false);
      setPaymentSent(false);
      // Advance order from "Quote Sent" to "Quote Accepted" after payment
      if (order.status === 2) {
        await updateOrderStatus(order.trackingCode, 3);
      }
      const updated = await getOrderByUUID(order.id);
      if (updated) setOrder(updated);
    } else {
      toast.info(result.message ?? 'Payment not yet confirmed. Please wait a moment and try again.');
    }
  };

  const handleAdvanceStatus = async (newStatus: number) => {
    if (!order) return;
    setAdvancing(true);
    const result = await updateOrderStatus(order.trackingCode, newStatus);
    setAdvancing(false);
    if (result.success && result.order) {
      setOrder(result.order);
      toast.success(`Order moved to "${statusToLabel(newStatus)}"`);
    } else {
      toast.error('Failed to update status', {
        description: 'The status transition may not be allowed. Please try again.',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order Not Found" description="We couldn't find the order you're looking for">
          <Button variant="outline" onClick={() => navigate(backRoute)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
        </PageHeader>
      </div>
    );
  }

  const timeline = buildTimeline(order.status);
  const canCancel = order.status >= 1 && order.status <= 3;
  const canPay = !isAdminView && !paymentComplete && order.status >= 1 && order.status <= 12 && order.status !== 13 && order.status !== 14;

  return (
    <div className="space-y-6">
      <PageHeader title={`Order #${order.trackingCode}`} description={`Placed on ${order.pickupDate ?? order.createdAt?.split('T')[0] ?? ''}`}>
        <Button variant="outline" onClick={() => navigate(backRoute)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Info & Items */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Order Details</CardTitle>
              <StatusBadge status={statusToLabel(order.status)} />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Zone</span>
                    <p className="font-medium">{order.zone}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Address</span>
                    <p className="font-medium">{order.pickupAddress ?? 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pickup Date</span>
                    <p className="font-medium">{order.pickupDate ?? 'TBD'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Est. Delivery</span>
                    <p className="font-medium">{order.estimatedDelivery ?? 'TBD'}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">Items</h4>
                  <div className="space-y-3">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>{item.name}</span>
                          <Badge variant="outline" className="text-xs">
                            x{item.quantity}
                          </Badge>
                          {item.lengthInches && item.widthInches && (
                            <span className="text-xs text-muted-foreground">
                              ({item.lengthInches}" x {item.widthInches}")
                            </span>
                          )}
                        </div>
                        <span className="font-medium">
                          KES {(item.totalPrice ?? item.unitPrice ?? 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>KES {(order.subtotal ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>KES {(order.deliveryFee ?? 0).toLocaleString()}</span>
                  </div>
                  {(order.vat ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">VAT (16%)</span>
                      <span>KES {(order.vat ?? 0).toLocaleString()}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>KES {(order.total ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground block">Name</span>
                    {isAdminView && order.customerId ? (
                      <button
                        className="font-medium text-primary hover:underline text-left"
                        onClick={() => navigate(`/admin/users/${order.customerId}`)}
                      >
                        {order.customerName}
                      </button>
                    ) : (
                      <span className="font-medium">{order.customerName}</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Driver Info */}
          {order.driverName && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Driver Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground block">Name</span>
                      {isAdminView && order.driverId ? (
                        <button
                          className="font-medium text-primary hover:underline text-left"
                          onClick={() => navigate(`/admin/users/${order.driverId}`)}
                        >
                          {order.driverName}
                        </button>
                      ) : (
                        <span className="font-medium">{order.driverName}</span>
                      )}
                    </div>
                  </div>
                  {order.driverPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground block">Phone</span>
                        <a href={`tel:${order.driverPhone}`} className="font-medium text-primary hover:underline">
                          {order.driverPhone}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Card */}
          {canPay && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Payment</p>
                      <p className="text-sm text-muted-foreground">
                        Pay KES {(order.total ?? 0).toLocaleString()} via M-Pesa
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setPayDialogOpen(true)} className="gap-2">
                    <Smartphone className="h-4 w-4" />
                    Pay Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Completed Card */}
          {!isAdminView && paymentComplete && !isCancelledOrRefunded(order.status) && (
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-200">Payment Received</p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      KES {(order.total ?? 0).toLocaleString()} paid via M-Pesa
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Timeline & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {isCancelledOrRefunded(order.status) && (
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-destructive/10 text-destructive">
                  <XCircle className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">{statusToLabel(order.status)}</p>
                    <p className="text-xs opacity-80">
                      This order was {order.status === 13 ? 'cancelled' : 'refunded'} on{' '}
                      {order.updatedAt ? new Date(order.updatedAt).toLocaleDateString('en-KE', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      }) : 'N/A'}
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                {timeline.map((step, i) => {
                  const isLast = i === timeline.length - 1;
                  const StepIcon = step.icon;
                  return (
                    <div key={step.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        {step.completed ? (
                          step.isCurrent ? (
                            <div className="relative">
                              <StepIcon className="h-5 w-5 text-primary shrink-0" />
                              <div className="absolute inset-0 -m-1 rounded-full bg-primary/20 animate-pulse" />
                            </div>
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                          )
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                        )}
                        {!isLast && (
                          <div
                            className={cn(
                              'w-0.5 flex-1 my-1 min-h-[1.5rem]',
                              step.completed ? 'bg-primary' : 'bg-muted'
                            )}
                          />
                        )}
                      </div>
                      <div className="pb-4">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            step.isCurrent && 'text-primary font-semibold',
                            !step.completed && !step.isCurrent && 'text-muted-foreground/50'
                          )}
                        >
                          {step.label}
                        </p>
                        {(step.isCurrent || step.completed) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {step.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Admin Status Controls */}
          {isAdminView && !isCancelledOrRefunded(order.status) && (VALID_TRANSITIONS[order.status] ?? []).length > 0 && (
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Advance Order</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(VALID_TRANSITIONS[order.status] ?? [])
                  .filter((s) => s !== 13 && s !== 14)
                  .map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      className="w-full"
                      onClick={() => handleAdvanceStatus(nextStatus)}
                      disabled={advancing}
                    >
                      {advancing ? 'Updating...' : getNextStatusLabel(nextStatus)}
                    </Button>
                  ))}
                {(VALID_TRANSITIONS[order.status] ?? [])
                  .filter((s) => s === 13 || s === 14)
                  .map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      variant="destructive"
                      className="w-full"
                      onClick={() => handleAdvanceStatus(nextStatus)}
                      disabled={advancing}
                    >
                      {getNextStatusLabel(nextStatus)}
                    </Button>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* ETA Card */}
          {order.estimatedDelivery && order.status < 12 && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Delivery</p>
                    <p className="font-semibold">{new Date(order.estimatedDelivery).toLocaleDateString('en-KE', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {canCancel && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setCancelOpen(true)}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          )}
        </div>
      </div>

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Order"
        description="Are you sure you want to cancel this order? This action cannot be undone."
        confirmLabel="Yes, Cancel Order"
        onConfirm={handleCancel}
        variant="destructive"
      />

      {/* Pay Now Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={(open) => {
        setPayDialogOpen(open);
        if (!open) {
          setPaymentSent(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pay via M-Pesa
            </DialogTitle>
            <DialogDescription>
              Enter your Safaricom phone number to receive the M-Pesa payment prompt
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order</span>
                <span className="font-medium">{order?.trackingCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-base">KES {(order?.total ?? 0).toLocaleString()}</span>
              </div>
            </div>

            {!paymentSent ? (
              <div className="space-y-2">
                <Label htmlFor="mpesa-phone">M-Pesa Phone Number</Label>
                <Input
                  id="mpesa-phone"
                  type="tel"
                  placeholder="e.g. 0712345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePayNow()}
                />
              </div>
            ) : (
              <div className="text-center space-y-3 py-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-green-600" />
                </div>
                <p className="font-medium">Payment prompt sent!</p>
                <p className="text-sm text-muted-foreground">
                  Check your phone and enter your M-Pesa PIN to complete the payment.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Close
            </Button>
            {!paymentSent ? (
              <Button onClick={handlePayNow} disabled={paymentLoading || !phoneNumber.trim()}>
                {paymentLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
                ) : (
                  <>Send Payment Prompt</>
                )}
              </Button>
            ) : (
              <Button onClick={handleVerifyPayment} disabled={verifying}>
                {verifying ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying...</>
                ) : (
                  <>I've Paid - Verify</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderDetails;
