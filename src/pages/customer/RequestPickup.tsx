import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, LocationPickerModal } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Ruler,
  Truck,
  Clock,
  Calculator,
  MapPin,
  CheckCircle2,
  Package,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '@/config/routes';
import { getAddresses, extractZoneFromAddress, type Address } from '@/services/addressService';
import {
  createOrder,
  calculateItemPrice,
  calculateETA,
  getDeliveryFee,
  PRICING,
  type CreateOrderPayload,
  type PickupRequestItem,
} from '@/services/orderService';
import { calculateServerPrice } from '@/services/pricingService';
import { useActiveZones } from '@/hooks/useZones';
import { PromoCodeInput } from '@/components/checkout/PromoCodeInput';
import { recordPromotionUsage } from '@/services/promotionService';

const ITEM_TYPES = [
  { value: 'carpet', label: 'Carpet' },
  { value: 'rug', label: 'Rug' },
  { value: 'curtain', label: 'Curtain' },
  { value: 'sofa', label: 'Sofa' },
  { value: 'mattress', label: 'Mattress' },
  { value: 'chair', label: 'Chair' },
  { value: 'pillow', label: 'Pillow' },
  { value: 'other', label: 'Other' },
];


interface ItemForm {
  id: string;
  name: string;
  itemType: string;
  quantity: number;
  lengthInches: string;
  widthInches: string;
}

function newItemForm(): ItemForm {
  return {
    id: crypto.randomUUID(),
    name: '',
    itemType: '',
    quantity: 1,
    lengthInches: '',
    widthInches: '',
  };
}

export const RequestPickup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCreated, setOrderCreated] = useState<{
    trackingCode: string;
    eta: string;
    total: number;
  } | null>(null);

  // Form state
  const [zone, setZone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | undefined>(undefined);
  const [pickupLng, setPickupLng] = useState<number | undefined>(undefined);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemForm[]>([newItemForm()]);
  const [eta, setEta] = useState<{ label: string; date: string } | null>(null);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promotionId, setPromotionId] = useState<string | null>(null);

  // Dynamic zones from DB
  const { data: activeZones = [] } = useActiveZones();

  // Saved addresses
  const { data: savedAddresses = [] } = useQuery({
    queryKey: ['addresses', user?.id],
    queryFn: () => getAddresses(user!.id),
    enabled: !!user?.id,
  });

  // Auto-fill from default address on load
  useEffect(() => {
    if (savedAddresses.length > 0 && !pickupAddress) {
      const defaultAddr = savedAddresses.find((a: Address) => a.isDefault) ?? savedAddresses[0];
      if (defaultAddr) {
        setPickupAddress(defaultAddr.addressLine);
        setZone(defaultAddr.zone);
        setPickupLat(defaultAddr.latitude);
        setPickupLng(defaultAddr.longitude);
      }
    }
  }, [savedAddresses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch ETA when zone changes
  useEffect(() => {
    let cancelled = false;

    if (zone) {
      calculateETA(zone)
        .then((result) => {
          if (!cancelled) setEta(result);
        })
        .catch((err) => {
          if (!cancelled) {
            setEta(null);
            toast.error('Unable to calculate delivery time. Please try again.');
            console.error('ETA calculation failed:', err);
          }
        });
    } else {
      setEta(null);
    }

    return () => {
      cancelled = true;
    };
  }, [zone]);

  const addItem = useCallback(() => setItems(prev => [...prev, newItemForm()]), []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.length <= 1 ? prev : prev.filter((i) => i.id !== id));
  }, []);

  const updateItem = useCallback((id: string, field: keyof ItemForm, value: string | number) => {
    setItems(prev => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }, []);

  // Calculate pricing for each item (memoized to prevent recalculation on every render)
  const calculatedItems: (ItemForm & {
    sqInches: number;
    pricePerSqInch: number;
    unitPrice: number;
    totalPrice: number;
    isValid: boolean;
  })[] = useMemo(() => items.map((item) => {
    const l = parseFloat(item.lengthInches) || 0;
    const w = parseFloat(item.widthInches) || 0;
    const isValid = l > 0 && w > 0 && item.itemType !== '' && item.name !== '';
    if (!isValid) {
      return { ...item, sqInches: 0, pricePerSqInch: 0, unitPrice: 0, totalPrice: 0, isValid };
    }
    const calc = calculateItemPrice(item.itemType, l, w, item.quantity);
    return { ...item, ...calc, isValid };
  }), [items]);

  // Memoize derived calculations
  const subtotal = useMemo(
    () => calculatedItems.reduce((sum, i) => sum + i.totalPrice, 0),
    [calculatedItems]
  );

  const deliveryFee = useMemo(() => {
    if (!zone) return 0;
    const matchedZone = activeZones.find((z) => z.name === zone);
    if (matchedZone) return matchedZone.base_delivery_fee;
    // Defensive fallback: zone DB is authoritative, but if not loaded yet use hardcoded values
    console.warn(`Zone "${zone}" not found in DB, using hardcoded delivery fee`);
    return getDeliveryFee(zone);
  }, [zone, activeZones]);

  const vatAmount = useMemo(
    () => Math.round((subtotal + deliveryFee) * PRICING.vatRate),
    [subtotal, deliveryFee]
  );

  const grandTotal = useMemo(
    () => subtotal + deliveryFee + vatAmount,
    [subtotal, deliveryFee, vatAmount]
  );

  const allValid = useMemo(
    () => calculatedItems.every((i) => i.isValid) && zone !== '' && pickupAddress !== '',
    [calculatedItems, zone, pickupAddress]
  );

  const hasItems = useMemo(
    () => calculatedItems.some((i) => i.isValid),
    [calculatedItems]
  );

  const handleSubmit = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to request a pickup');
      return;
    }
    if (!allValid || !hasItems) {
      toast.error('Please fill in all item details and select a zone');
      return;
    }
    if (grandTotal < PRICING.minimumOrder) {
      toast.error(`Minimum order is KES ${PRICING.minimumOrder}`);
      return;
    }

    setIsSubmitting(true);

    // Server-side pricing validation
    let validatedSubtotal = subtotal;
    let validatedDeliveryFee = deliveryFee;
    let validatedVat = vatAmount;
    let validatedTotal = grandTotal;
    let serverDiscount = 0;

    try {
      const serverItems = calculatedItems
        .filter((i) => i.isValid)
        .map((i) => ({
          item_type: i.itemType,
          length_inches: parseFloat(i.lengthInches),
          width_inches: parseFloat(i.widthInches),
          quantity: i.quantity,
        }));

      const serverPrice = await calculateServerPrice(serverItems, zone, promoCode ?? undefined, user.id);
      validatedSubtotal = serverPrice.subtotal;
      validatedDeliveryFee = serverPrice.delivery_fee;
      validatedVat = serverPrice.vat_amount;
      validatedTotal = serverPrice.total;
      serverDiscount = serverPrice.discount;
    } catch {
      // If a promo code was applied, we must not silently proceed without the discount
      if (promoCode) {
        setIsSubmitting(false);
        toast.error('Unable to validate pricing with your promo code. Please try again.');
        return;
      }
      // Without promo, fall back to frontend pricing is acceptable
    }

    const payload: CreateOrderPayload = {
      customerId: user.id,
      customerName: user.name,
      zone,
      pickupAddress,
      pickupDate,
      items: calculatedItems
        .filter((i) => i.isValid)
        .map((i) => ({
          name: i.name,
          itemType: i.itemType,
          quantity: i.quantity,
          lengthInches: parseFloat(i.lengthInches),
          widthInches: parseFloat(i.widthInches),
          pricePerSqInch: i.pricePerSqInch,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
      subtotal: validatedSubtotal,
      deliveryFee: validatedDeliveryFee,
      vat: validatedVat,
      total: validatedTotal,
      notes: notes || undefined,
      promoCode: promoCode ?? undefined,
      promotionId: promotionId ?? undefined,
      skipServerPricing: true, // Already validated above
    };

    const result = await createOrder(payload);
    setIsSubmitting(false);

    if (result.success && result.order) {
      // Record promotion usage if a promo was applied
      if (promotionId && result.order.id && serverDiscount > 0) {
        try {
          await recordPromotionUsage(promotionId, result.order.id, serverDiscount);
        } catch {
          // Non-critical, don't block order success
        }
      }

      setOrderCreated({
        trackingCode: result.order.trackingCode,
        eta: eta?.label ?? 'To be confirmed',
        total: validatedTotal,
      });
      toast.success('Pickup request submitted!');
    } else {
      toast.error(result.error ?? 'Failed to create order');
    }
  }, [user, allValid, hasItems, grandTotal, zone, pickupAddress, pickupDate, calculatedItems, subtotal, deliveryFee, vatAmount, notes, eta, promoCode, promotionId]);

  // Success state
  if (orderCreated) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pickup Requested!"
          description="Your order has been submitted successfully"
        />
        <Card className="max-w-lg mx-auto">
          <CardContent className="py-10 text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Order Confirmed</h3>
              <p className="text-muted-foreground mt-1">
                A driver will be assigned shortly
              </p>
            </div>
            <div className="bg-muted/50 rounded-xl p-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tracking Code</span>
                <span className="font-bold text-lg">{orderCreated.trackingCode}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Delivery</span>
                <span className="font-medium">{orderCreated.eta}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-primary">
                  KES {orderCreated.total.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate(ROUTES.CUSTOMER_ORDERS)}
              >
                View Orders
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setOrderCreated(null);
                  setItems([newItemForm()]);
                  setNotes('');
                }}
              >
                New Pickup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request Pickup"
        description="Enter your item dimensions for an instant quote"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Item Entry */}
        <div className="lg:col-span-2 space-y-6">
          {/* Zone & Address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Pickup Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Zone *</Label>
                  <Select value={zone} onValueChange={setZone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeZones.map((z) => (
                        <SelectItem key={z.id} value={z.name}>
                          {z.name} — KES {z.base_delivery_fee.toLocaleString()}
                          {z.delivery_policy === 'same_day' ? ' (Same Day)' : ' (48hr)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pickup Date *</Label>
                  <Input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              {savedAddresses.length > 0 && (
                <div>
                  <Label>Saved Addresses</Label>
                  <Select
                    value=""
                    onValueChange={(addrId) => {
                      const addr = savedAddresses.find((a: Address) => a.id === addrId);
                      if (addr) {
                        setPickupAddress(addr.addressLine);
                        setZone(addr.zone);
                        setPickupLat(addr.latitude);
                        setPickupLng(addr.longitude);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose from saved addresses" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedAddresses.map((addr: Address) => (
                        <SelectItem key={addr.id} value={addr.id}>
                          {addr.label} — {addr.addressLine} ({addr.zone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Pickup Address *</Label>
                <div className="relative">
                  <Input
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="e.g. 45 Namanga Road, Kitengela"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setMapPickerOpen(true)}
                    title="Pick on map"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Gate code, landmarks, special instructions..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ruler className="h-5 w-5" />
                Items & Dimensions
              </CardTitle>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the length and width of each item in inches. Price is calculated per square inch based on item type.
              </p>

              {items.map((item, idx) => {
                const calc = calculatedItems[idx];
                return (
                  <div
                    key={item.id}
                    className="border rounded-xl p-4 space-y-3 relative"
                  >
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}

                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Item {idx + 1}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Item Name *</Label>
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                          placeholder="e.g. Living Room Carpet"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Item Type *</Label>
                        <Select
                          value={item.itemType}
                          onValueChange={(v) => updateItem(item.id, 'itemType', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {ITEM_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Length (inches) *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.lengthInches}
                          onChange={(e) =>
                            updateItem(item.id, 'lengthInches', e.target.value)
                          }
                          placeholder="e.g. 120"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Width (inches) *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.widthInches}
                          onChange={(e) =>
                            updateItem(item.id, 'widthInches', e.target.value)
                          }
                          placeholder="e.g. 84"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)
                          }
                        />
                      </div>
                    </div>

                    {/* Price breakdown for this item */}
                    {calc.isValid && (
                      <div className="bg-muted/50 rounded-lg p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                        <span className="text-muted-foreground">
                          {calc.sqInches.toLocaleString()} sq in
                        </span>
                        <span className="text-muted-foreground">
                          @ KES {calc.pricePerSqInch.toFixed(2)}/sq in
                        </span>
                        <span className="text-muted-foreground">
                          = KES {calc.unitPrice.toLocaleString()} each
                        </span>
                        {item.quantity > 1 && (
                          <span className="font-medium text-foreground">
                            x{item.quantity} = KES {calc.totalPrice.toLocaleString()}
                          </span>
                        )}
                        {item.quantity === 1 && (
                          <span className="font-medium text-foreground">
                            KES {calc.totalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right - Quote Summary */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Quote Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasItems ? (
                <>
                  {/* Items breakdown */}
                  <div className="space-y-2">
                    {calculatedItems
                      .filter((i) => i.isValid)
                      .map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-muted-foreground truncate mr-2">
                            {item.name || item.itemType}
                            {item.quantity > 1 && ` x${item.quantity}`}
                          </span>
                          <span className="font-medium shrink-0">
                            KES {item.totalPrice.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>KES {subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        Delivery Fee
                      </span>
                      <span>
                        {zone
                          ? `KES ${deliveryFee.toLocaleString()}`
                          : 'Select zone'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">VAT (16%)</span>
                      <span>KES {vatAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Promo Code */}
                  <PromoCodeInput
                    subtotal={subtotal}
                    onApply={(code, id) => {
                      setPromoCode(code);
                      setPromotionId(id);
                    }}
                  />

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-xl font-bold text-primary">
                      KES {grandTotal.toLocaleString()}
                    </span>
                  </div>
                  {promoCode && (
                    <p className="text-xs text-green-600">
                      * Final discount will be applied server-side at checkout
                    </p>
                  )}

                  {/* ETA */}
                  {eta && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
                      <Clock className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Estimated Delivery</p>
                        <p className="text-xs text-muted-foreground">
                          {eta.label} ({eta.date})
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Price and delivery info */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Pricing is based on item dimensions (per sq inch)</p>
                    <p>• Final price may vary after driver measures on pickup</p>
                    <p>• Deliveries Monday-Friday only (weekends excluded)</p>
                    {zone && (() => {
                      const matchedZone = activeZones.find((az) => az.name === zone);
                      return matchedZone?.delivery_policy === 'same_day' ? (
                        <p className="text-primary font-medium">
                          • Same day delivery available if ordered before cutoff ({matchedZone.cutoff_time?.slice(0, 5) || '12:00'})
                        </p>
                      ) : null;
                    })()}
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!allValid || !hasItems || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Confirm Pickup Request
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <Ruler className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Enter item dimensions to see your instant quote
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Location Picker Modal */}
      <LocationPickerModal
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        onSelect={({ address, lat, lng }) => {
          setPickupAddress(address);
          setPickupLat(lat);
          setPickupLng(lng);
          // Try to extract zone from the address
          const matchedZone = extractZoneFromAddress(address);
          if (matchedZone) setZone(matchedZone);
        }}
        initialCenter={pickupLat && pickupLng ? { lat: pickupLat, lng: pickupLng } : undefined}
        initialAddress={pickupAddress}
      />
    </div>
  );
};

export default RequestPickup;
