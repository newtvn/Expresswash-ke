import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, StatusBadge, ConfirmDialog } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/routes';
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

const /* mockOrderDetails */ []: Record<string, {
  id: string;
  status: string;
  date: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  zone: string;
  address: string;
  driver: { name: string; phone: string; vehicle: string } | null;
  timeline: { label: string; date: string; completed: boolean }[];
}> = {
  'EW-2025-00412': {
    id: 'EW-2025-00412',
    status: 'processing',
    date: '2025-01-28',
    items: [
      { name: 'Living Room Carpet (Large)', quantity: 2, price: 1200 },
      { name: 'Persian Rug (Medium)', quantity: 1, price: 1100 },
    ],
    subtotal: 3500,
    deliveryFee: 300,
    discount: 300,
    total: 3500,
    zone: 'Kitengela',
    address: '45 Namanga Road, Kitengela',
    driver: { name: 'James Kiprop', phone: '+254 712 345 678', vehicle: 'Toyota HiAce - KDA 456J' },
    timeline: [
      { label: 'Order Placed', date: '2025-01-28 09:00', completed: true },
      { label: 'Pickup Scheduled', date: '2025-01-28 10:30', completed: true },
      { label: 'Items Picked Up', date: '2025-01-28 14:00', completed: true },
      { label: 'In Washing', date: '2025-01-29 08:00', completed: true },
      { label: 'Quality Check', date: '', completed: false },
      { label: 'Ready for Delivery', date: '', completed: false },
      { label: 'Delivered', date: '', completed: false },
    ],
  },
};

const fallbackOrder = {
  id: 'EW-2025-00000',
  status: 'pending',
  date: '2025-01-20',
  items: [
    { name: 'Carpet (Standard)', quantity: 1, price: 800 },
    { name: 'Curtain Pair', quantity: 2, price: 600 },
  ],
  subtotal: 2000,
  deliveryFee: 250,
  discount: 0,
  total: 2250,
  zone: 'Athi River',
  address: '12 Mombasa Road, Athi River',
  driver: null,
  timeline: [
    { label: 'Order Placed', date: '2025-01-20 11:00', completed: true },
    { label: 'Pickup Scheduled', date: '', completed: false },
    { label: 'Items Picked Up', date: '', completed: false },
    { label: 'In Washing', date: '', completed: false },
    { label: 'Quality Check', date: '', completed: false },
    { label: 'Ready for Delivery', date: '', completed: false },
    { label: 'Delivered', date: '', completed: false },
  ],
};

export const OrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);

  const order = /* mockOrderDetails */ [][id ?? ''] ?? { ...fallbackOrder, id: id ?? fallbackOrder.id };
  const canCancel = ['pending', 'picked_up'].includes(order.status);

  return (
    <div className="space-y-6">
      <PageHeader title={`Order #${order.id}`} description={`Placed on ${order.date}`}>
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
              <StatusBadge status={order.status} />
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
                    <p className="font-medium">{order.address}</p>
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
                        <span className="font-medium">KES {item.price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>KES {order.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>KES {order.deliveryFee.toLocaleString()}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-KES {order.discount.toLocaleString()}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>KES {order.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Driver Info */}
          {order.driver && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Driver Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground block">Name</span>
                      <span className="font-medium">{order.driver.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground block">Phone</span>
                      <span className="font-medium">{order.driver.phone}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground block">Vehicle</span>
                      <span className="font-medium">{order.driver.vehicle}</span>
                    </div>
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
              <div className="space-y-4">
                {order.timeline.map((step, i) => {
                  const isLast = i === order.timeline.length - 1;
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
                        {step.date && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {step.date}
                          </p>
                        )}
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
            >
              Cancel Order
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
        onConfirm={() => setCancelOpen(false)}
        variant="destructive"
      />
    </div>
  );
};

export default OrderDetails;
