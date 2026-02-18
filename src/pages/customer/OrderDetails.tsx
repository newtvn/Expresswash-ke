import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, StatusBadge, ConfirmDialog } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/config/routes';
import { getOrderByUUID, cancelOrder } from '@/services/orderService';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const statusToLabel = (status: number): string => {
  const stage = ORDER_STAGES.find((s) => s.id === status);
  return stage?.name ?? 'Unknown';
};

const buildTimeline = (currentStatus: number) => {
  return ORDER_STAGES.map((stage) => ({
    label: stage.name,
    completed: currentStatus >= stage.id,
  }));
};

export const OrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getOrderByUUID(id)
      .then((result) => setOrder(result))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancel = async () => {
    if (!order) return;
    setCancelling(true);
    const result = await cancelOrder(order.trackingCode);
    setCancelling(false);
    setCancelOpen(false);
    if (result.success) {
      toast.success('Order cancelled successfully');
      // Refresh order data
      const updated = await getOrderByUUID(order.id);
      if (updated) setOrder(updated);
    } else {
      toast.error(result.message);
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
          <Button variant="outline" onClick={() => navigate(ROUTES.CUSTOMER_ORDERS)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
        </PageHeader>
      </div>
    );
  }

  const timeline = buildTimeline(order.status);
  const canCancel = order.status >= 1 && order.status <= 3;

  return (
    <div className="space-y-6">
      <PageHeader title={`Order #${order.trackingCode}`} description={`Placed on ${order.pickupDate ?? order.createdAt?.split('T')[0] ?? ''}`}>
        <Button variant="outline" onClick={() => navigate(ROUTES.CUSTOMER_ORDERS)}>
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
                      <span className="font-medium">{order.driverName}</span>
                    </div>
                  </div>
                  {order.driverPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground block">Phone</span>
                        <span className="font-medium">{order.driverPhone}</span>
                      </div>
                    </div>
                  )}
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
              <div className="space-y-4">
                {timeline.map((step, i) => {
                  const isLast = i === timeline.length - 1;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        {step.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                        {!isLast && (
                          <div
                            className={cn(
                              'w-0.5 flex-1 my-1',
                              step.completed ? 'bg-primary' : 'bg-muted'
                            )}
                          />
                        )}
                      </div>
                      <div className="pb-4">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            !step.completed && 'text-muted-foreground'
                          )}
                        >
                          {step.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

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

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Order"
        description="Are you sure you want to cancel this order? This action cannot be undone."
        confirmLabel="Yes, Cancel Order"
        onConfirm={handleCancel}
        variant="destructive"
      />
    </div>
  );
};

export default OrderDetails;
