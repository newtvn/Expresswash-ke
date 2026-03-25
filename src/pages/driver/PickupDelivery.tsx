import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Clock, CheckCircle, Package, Navigation, Phone, Ruler, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getDriverRoutes, completeRouteStop } from '@/services/driverService';
import { updateOrderStatus, getOrderByUUID, calculateItemPrice, updateOrderItems, PRICING } from '@/services/orderService';
import { ORDER_STATUS } from '@/constants/orderStatus';

interface MeasurementDialogData {
  stopId: string;
  orderId: string;
  type: 'pickup' | 'delivery';
  items: Array<{
    name: string;
    itemType: string;
    quantity: number;
    originalLength: number;
    originalWidth: number;
    measuredLength: string;
    measuredWidth: string;
  }>;
}

export const PickupDelivery = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const [measurementDialog, setMeasurementDialog] = useState<MeasurementDialogData | null>(null);
  const [submittingMeasurements, setSubmittingMeasurements] = useState(false);

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['driver', 'routes', user?.id, today],
    queryFn: () => getDriverRoutes(user!.id, today),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  /**
   * Driver-allowed status transitions:
   * Pickup flow:  -> PICKED_UP (5) -> then warehouse staff takes over
   * Delivery flow: -> OUT_FOR_DELIVERY (11) -> DELIVERED (12)
   */
  const completeMutation = useMutation({
    mutationFn: async ({ stopId, orderId, type }: { stopId: string; orderId: string; type: 'pickup' | 'delivery' }) => {
      await completeRouteStop(stopId);
      const newStatus = type === 'pickup'
        ? ORDER_STATUS.PICKED_UP
        : ORDER_STATUS.DELIVERED;
      await updateOrderStatus(orderId, newStatus);
    },
    onSuccess: () => {
      toast.success('Stop completed and order updated!');
      qc.invalidateQueries({ queryKey: ['driver', 'routes', user?.id] });
      setMeasurementDialog(null);
    },
    onError: () => toast.error('Failed to complete stop'),
  });

  // Separate mutation for driver-only status updates (e.g. Out for Delivery)
  const statusUpdateMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: number }) => {
      // Guard: drivers can only set these statuses
      const allowedStatuses = [
        ORDER_STATUS.PICKED_UP,
        ORDER_STATUS.OUT_FOR_DELIVERY,
        ORDER_STATUS.DELIVERED,
      ];
      if (!allowedStatuses.includes(status)) {
        throw new Error('You are not authorized to set this status');
      }
      await updateOrderStatus(orderId, status);
    },
    onSuccess: () => {
      toast.success('Order status updated!');
      qc.invalidateQueries({ queryKey: ['driver', 'routes', user?.id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update status'),
  });

  // Open measurement dialog for pickup
  const handleCompletePickup = async (stopId: string, orderId: string) => {
    try {
      // Fetch order details to get items
      const order = await getOrderByUUID(orderId);
      if (!order) {
        toast.error('Order not found', {
          description: 'The order may have been cancelled or deleted',
        });
        return;
      }
      if (!order.items || order.items.length === 0) {
        toast.error('No items found in order', {
          description: 'Please contact support if this issue persists',
        });
        return;
      }

      // Prepare measurement dialog data
      setMeasurementDialog({
        stopId,
        orderId,
        type: 'pickup',
        items: order.items.map((item) => ({
          name: item.name,
          itemType: item.itemType ?? 'other',
          quantity: item.quantity,
          originalLength: item.lengthInches ?? 0,
          originalWidth: item.widthInches ?? 0,
          measuredLength: String(item.lengthInches ?? ''),
          measuredWidth: String(item.widthInches ?? ''),
        })),
      });
    } catch (error) {
      toast.error('Failed to load order details', {
        description: error instanceof Error ? error.message : 'Please check your connection and try again',
      });
    }
  };

  // Submit measurements and complete pickup
  const handleSubmitMeasurements = async () => {
    if (!measurementDialog) return;

    setSubmittingMeasurements(true);

    try {
      // Validate all items have measurements
      const invalidItems = measurementDialog.items.filter(item => {
        const measuredL = parseFloat(item.measuredLength) || 0;
        const measuredW = parseFloat(item.measuredWidth) || 0;
        return measuredL === 0 || measuredW === 0;
      });

      if (invalidItems.length > 0) {
        toast.error('Missing measurements', {
          description: `Please measure all ${measurementDialog.items.length} items before completing pickup`,
        });
        setSubmittingMeasurements(false);
        return;
      }

      // Calculate new pricing based on actual measurements
      const updatedItems = measurementDialog.items.map((item) => {
        const measuredL = parseFloat(item.measuredLength);
        const measuredW = parseFloat(item.measuredWidth);

        const pricing = calculateItemPrice(item.itemType, measuredL, measuredW, item.quantity);
        return {
          name: item.name,
          itemType: item.itemType,
          quantity: item.quantity,
          lengthInches: measuredL,
          widthInches: measuredW,
          unitPrice: pricing.unitPrice,
          totalPrice: pricing.totalPrice,
        };
      });

      // Calculate new subtotal and total
      const newSubtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0);

      // Fetch current order to get delivery fee
      const currentOrder = await getOrderByUUID(measurementDialog.orderId);
      if (!currentOrder) {
        throw new Error('Order not found. It may have been cancelled or deleted.');
      }

      const deliveryFee = currentOrder.deliveryFee ?? 0;
      const vat = Math.round((newSubtotal + deliveryFee) * PRICING.vatRate);
      const newTotal = newSubtotal + deliveryFee + vat;

      // Update order items with new measurements
      const updateResult = await updateOrderItems(
        measurementDialog.orderId,
        updatedItems,
        newSubtotal,
        newTotal
      );

      if (!updateResult.success) {
        throw new Error(updateResult.error ?? 'Failed to save measurements to database. Please try again.');
      }

      // Complete the pickup
      await completeMutation.mutateAsync({
        stopId: measurementDialog.stopId,
        orderId: measurementDialog.orderId,
        type: 'pickup',
      });

      setMeasurementDialog(null);
      toast.success('Pickup completed successfully!', {
        description: `Order total updated to KES ${newTotal.toLocaleString()} based on actual measurements`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error('Failed to complete pickup', {
        description: errorMessage,
      });
    } finally {
      setSubmittingMeasurements(false);
    }
  };

  const updateMeasurement = (index: number, field: 'measuredLength' | 'measuredWidth', value: string) => {
    if (!measurementDialog) return;

    const updatedItems = [...measurementDialog.items];
    updatedItems[index][field] = value;
    setMeasurementDialog({ ...measurementDialog, items: updatedItems });
  };

  const allStops = routes.flatMap((r) =>
    r.stops.map((s) => ({ ...s, routeId: r.id, routeDate: r.date }))
  );

  const pickupStops = allStops.filter((s) => s.type === 'pickup');
  const deliveryStops = allStops.filter((s) => s.type === 'delivery');

  const StopCard = ({ stop }: { stop: typeof allStops[0] }) => (
    <Card className={stop.status === 'completed' ? 'opacity-60' : ''}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">#{stop.orderId}</span>
              <Badge variant={stop.status === 'completed' ? 'secondary' : 'default'} className="text-xs capitalize">{stop.status}</Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{stop.address}</div>
              <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{stop.scheduledTime}</div>
              <div className="flex items-center gap-1"><Package className="h-3 w-3" />{stop.customerName}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {stop.status === 'pending' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(stop.address)}`)}
                >
                  <Navigation className="h-3 w-3 mr-1" /> Navigate
                </Button>
                {stop.type === 'pickup' ? (
                  <Button
                    size="sm"
                    onClick={() => handleCompletePickup(stop.id ?? stop.orderId, stop.orderId)}
                    disabled={completeMutation.isPending}
                  >
                    <Ruler className="h-3 w-3 mr-1" /> Measure & Pick Up
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        statusUpdateMutation.mutate({
                          orderId: stop.orderId,
                          status: ORDER_STATUS.OUT_FOR_DELIVERY,
                        })
                      }
                      disabled={statusUpdateMutation.isPending}
                    >
                      <Truck className="h-3 w-3 mr-1" /> Out for Delivery
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        completeMutation.mutate({
                          stopId: stop.id ?? stop.orderId,
                          orderId: stop.orderId,
                          type: stop.type,
                        })
                      }
                      disabled={completeMutation.isPending}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Mark Delivered
                    </Button>
                  </>
                )}
              </>
            )}
            {stop.status === 'completed' && (
              <Badge className="bg-green-100 text-green-800 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> Done
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Pickups & Deliveries" description="Manage today's assignments" />

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : (
        <Tabs defaultValue="pickups">
          <TabsList>
            <TabsTrigger value="pickups">Pickups ({pickupStops.filter((s) => s.status === 'pending').length} pending)</TabsTrigger>
            <TabsTrigger value="deliveries">Deliveries ({deliveryStops.filter((s) => s.status === 'pending').length} pending)</TabsTrigger>
          </TabsList>
          <TabsContent value="pickups" className="mt-4 space-y-3">
            {pickupStops.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pickups scheduled today</p>
            ) : pickupStops.map((s, i) => <StopCard key={s.id ?? i} stop={s} />)}
          </TabsContent>
          <TabsContent value="deliveries" className="mt-4 space-y-3">
            {deliveryStops.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No deliveries scheduled today</p>
            ) : deliveryStops.map((s, i) => <StopCard key={s.id ?? i} stop={s} />)}
          </TabsContent>
        </Tabs>
      )}

      {/* Measurement Dialog */}
      <Dialog open={!!measurementDialog} onOpenChange={() => setMeasurementDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Measure Items
            </DialogTitle>
            <DialogDescription>
              Enter the actual measurements for each item during pickup
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {measurementDialog?.items.map((item, idx) => {
              const measuredL = parseFloat(item.measuredLength) || 0;
              const measuredW = parseFloat(item.measuredWidth) || 0;
              const isValid = measuredL > 0 && measuredW > 0;

              let priceDiff = 0;
              let newPrice = 0;
              if (isValid) {
                // Calculate original price correctly
                const originalCalc = calculateItemPrice(
                  item.itemType,
                  item.originalLength,
                  item.originalWidth,
                  item.quantity
                );
                const originalPrice = originalCalc.totalPrice;

                // Calculate new price
                const newCalc = calculateItemPrice(item.itemType, measuredL, measuredW, item.quantity);
                newPrice = newCalc.totalPrice;
                priceDiff = newPrice - originalPrice;
              }

              return (
                <Card key={idx}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{item.itemType} × {item.quantity}</p>
                      </div>
                      <Badge variant="outline">
                        Original: {item.originalLength}" × {item.originalWidth}"
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Actual Length (inches)</Label>
                        <Input
                          type="number"
                          min="1"
                          step="0.5"
                          value={item.measuredLength}
                          onChange={(e) => updateMeasurement(idx, 'measuredLength', e.target.value)}
                          placeholder={String(item.originalLength)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Actual Width (inches)</Label>
                        <Input
                          type="number"
                          min="1"
                          step="0.5"
                          value={item.measuredWidth}
                          onChange={(e) => updateMeasurement(idx, 'measuredWidth', e.target.value)}
                          placeholder={String(item.originalWidth)}
                        />
                      </div>
                    </div>

                    {isValid && (
                      <div className="bg-muted/50 rounded-lg p-2 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">New Size:</span>
                          <span className="font-medium">{measuredL * measuredW} sq in</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">New Price:</span>
                          <span className="font-medium">KES {newPrice.toLocaleString()}</span>
                        </div>
                        {Math.abs(priceDiff) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Difference:</span>
                            <span className={`font-medium ${priceDiff > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              {priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(0)} KES
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-3">
              💡 Tip: The customer will be notified of any price changes due to measurement differences.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMeasurementDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitMeasurements} disabled={submittingMeasurements}>
              {submittingMeasurements ? 'Saving...' : 'Complete Pickup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PickupDelivery;
