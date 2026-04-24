import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, CheckCircle, MapPin, Gift } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { createOrder, calculateItemPrice, getDeliveryFee, getExpressSurcharge, EXPRESS_SURCHARGE, PRICING } from '@/services/orderService';
import type { PickupRequestItem } from '@/services/orderService';
import { getAddresses, type Address } from '@/services/addressService';
import { LocationPickerModal } from '@/components/shared';

interface PlaceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ITEM_TYPES = [
  'Carpet (Small)', 'Carpet (Medium)', 'Carpet (Large)', 'Persian Rug', 'Office Rug',
  'Sofa (2-Seater)', 'Sofa (3-Seater)', 'Sofa (L-Shaped)', 'Mattress (Single)',
  'Mattress (Double)', 'Mattress (King)', 'Curtain Pair', 'Duvet/Blanket',
  'Chair', 'Car Seat Covers', 'Pillow', 'Other',
];

const ZONES = ['Kitengela', 'Athi River', 'Syokimau', 'Mlolongo'];

const ITEM_DEFAULTS: Record<string, { itemType: string; lengthInches: number; widthInches: number }> = {
  'Carpet (Small)':    { itemType: 'carpet',   lengthInches: 48,  widthInches: 36 },
  'Carpet (Medium)':   { itemType: 'carpet',   lengthInches: 72,  widthInches: 48 },
  'Carpet (Large)':    { itemType: 'carpet',   lengthInches: 120, widthInches: 84 },
  'Persian Rug':       { itemType: 'rug',      lengthInches: 96,  widthInches: 60 },
  'Office Rug':        { itemType: 'rug',       lengthInches: 72,  widthInches: 48 },
  'Sofa (2-Seater)':   { itemType: 'sofa',     lengthInches: 60,  widthInches: 36 },
  'Sofa (3-Seater)':   { itemType: 'sofa',     lengthInches: 84,  widthInches: 36 },
  'Sofa (L-Shaped)':   { itemType: 'sofa',     lengthInches: 108, widthInches: 60 },
  'Mattress (Single)': { itemType: 'mattress',  lengthInches: 75,  widthInches: 39 },
  'Mattress (Double)': { itemType: 'mattress',  lengthInches: 75,  widthInches: 54 },
  'Mattress (King)':   { itemType: 'mattress',  lengthInches: 80,  widthInches: 76 },
  'Curtain Pair':      { itemType: 'curtain',   lengthInches: 84,  widthInches: 54 },
  'Duvet/Blanket':     { itemType: 'other',     lengthInches: 90,  widthInches: 90 },
  'Chair':             { itemType: 'chair',     lengthInches: 36,  widthInches: 36 },
  'Car Seat Covers':   { itemType: 'other',     lengthInches: 48,  widthInches: 24 },
  'Pillow':            { itemType: 'pillow',    lengthInches: 26,  widthInches: 20 },
  'Other':             { itemType: 'other',     lengthInches: 48,  widthInches: 36 },
};

export const PlaceOrderDialog = ({ open, onOpenChange }: PlaceOrderDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const loyaltyTier = user?.loyaltyTier;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [trackingCode, setTrackingCode] = useState('');
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [serviceType, setServiceType] = useState<'standard' | 'express'>('standard');

  const [form, setForm] = useState({
    zone: user?.zone ?? '',
    pickupDate: '',
    pickupAddress: '',
    notes: '',
    items: [{ name: '', quantity: 1 }] as { name: string; quantity: number }[],
    pickupLat: undefined as number | undefined,
    pickupLng: undefined as number | undefined,
  });

  // Saved addresses - auto-fill default
  const { data: savedAddresses = [] } = useQuery({
    queryKey: ['addresses', user?.id],
    queryFn: () => getAddresses(user!.id),
    enabled: !!user?.id && open,
    onSuccess: (addrs: Address[]) => {
      if (addrs.length > 0 && !form.pickupAddress) {
        const defaultAddr = addrs.find(a => a.isDefault) ?? addrs[0];
        if (defaultAddr) {
          setForm(prev => ({ ...prev, pickupAddress: defaultAddr.addressLine, zone: defaultAddr.zone, pickupLat: defaultAddr.latitude, pickupLng: defaultAddr.longitude }));
        }
      }
    },
  });

  const addItem = () => setForm({ ...form, items: [...form.items, { name: '', quantity: 1 }] });
  const removeItem = (i: number) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i: number, field: 'name' | 'quantity', value: string | number) =>
    setForm({ ...form, items: form.items.map((item, idx) => idx === i ? { ...item, [field]: value } : item) });

  // Compute pricing from selected items and zone
  const pricing = useMemo(() => {
    const validItems = form.items.filter((i) => i.name.trim() !== '');
    const pricedItems: PickupRequestItem[] = validItems.map((item) => {
      const defaults = ITEM_DEFAULTS[item.name] ?? ITEM_DEFAULTS['Other'];
      const calc = calculateItemPrice(defaults.itemType, defaults.lengthInches, defaults.widthInches, item.quantity);
      return {
        name: item.name,
        itemType: defaults.itemType,
        quantity: item.quantity,
        lengthInches: defaults.lengthInches,
        widthInches: defaults.widthInches,
        pricePerSqInch: calc.pricePerSqInch,
        unitPrice: calc.unitPrice,
        totalPrice: calc.totalPrice,
      };
    });
    const subtotal = pricedItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const deliveryFee = form.zone ? getDeliveryFee(form.zone, loyaltyTier) : 0;
    const expressSurcharge = getExpressSurcharge(serviceType, loyaltyTier);
    const vat = Math.round((subtotal + deliveryFee + expressSurcharge) * PRICING.vatRate);
    const total = subtotal + deliveryFee + expressSurcharge + vat;
    return { pricedItems, subtotal, deliveryFee, expressSurcharge, vat, total };
  }, [form.items, form.zone, serviceType, loyaltyTier]);

  const mutation = useMutation({
    mutationFn: () =>
      createOrder({
        customerId: user!.id,
        customerName: user!.name,
        zone: form.zone,
        pickupDate: form.pickupDate,
        pickupAddress: form.pickupAddress,
        notes: form.notes || undefined,
        items: pricing.pricedItems,
        subtotal: pricing.subtotal,
        deliveryFee: pricing.deliveryFee,
        vat: pricing.vat,
        total: pricing.total,
      }),
    onSuccess: (data) => {
      if (data.success && data.order) {
        setTrackingCode(data.order.trackingCode);
        setStep(3);
        qc.invalidateQueries({ queryKey: ['customer', 'orders', user?.id] });
        toast.success(`Order ${data.order.trackingCode} placed successfully!`);
      } else {
        toast.error(data.error ?? 'Failed to place order');
      }
    },
  });

  const canProceedStep1 = form.items.some((i) => i.name.trim() !== '');

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep(1);
      setTrackingCode('');
      setServiceType('standard');
      setForm({ zone: user?.zone ?? '', pickupDate: '', pickupAddress: '', notes: '', items: [{ name: '', quantity: 1 }], pickupLat: undefined, pickupLng: undefined });
    }, 300);
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'What needs cleaning?' : step === 2 ? 'Pickup Details' : 'Order Placed!'}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        {step < 3 && (
          <div className="flex gap-2 mb-2">
            {[1, 2].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Items to Clean *</Label>
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Select value={item.name} onValueChange={(v) => updateItem(i, 'name', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select item type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={item.quantity}
                      onChange={(e) => updateItem(i, 'quantity', Math.max(1, Number(e.target.value)))}
                      className="text-center"
                    />
                  </div>
                  {form.items.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={() => removeItem(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addItem} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Add Another Item
              </Button>
            </div>

            <div>
              <Label htmlFor="order-notes">Special Instructions (optional)</Label>
              <Textarea
                id="order-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Heavy stains, delicate fabric, etc."
                rows={2}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Items Summary</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {form.items.filter((i) => i.name).map((item, i) => (
                  <Badge key={i} variant="secondary">{item.quantity}x {item.name}</Badge>
                ))}
              </div>
            </div>

            {pricing.pricedItems.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <Label className="text-xs text-muted-foreground">Estimated Pricing</Label>
                {pricing.pricedItems.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.quantity}x {item.name}</span>
                    <span className="font-medium">KES {item.totalPrice.toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t pt-1 mt-1 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>KES {pricing.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery ({form.zone || '—'})</span>
                    <span>
                      {pricing.deliveryFee === 0 && (loyaltyTier === 'gold' || loyaltyTier === 'platinum')
                        ? (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <Gift className="h-3 w-3" />
                            Free (Gold+ perk)
                          </span>
                        )
                        : `KES ${pricing.deliveryFee.toLocaleString()}`}
                    </span>
                  </div>
                  {serviceType === 'express' && (
                    <div className="flex justify-between">
                      <span>Express Surcharge</span>
                      <span>
                        {pricing.expressSurcharge === 0
                          ? (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <Gift className="h-3 w-3" />
                              Free (Platinum perk)
                            </span>
                          )
                          : `KES ${pricing.expressSurcharge.toLocaleString()}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>VAT (16%)</span>
                    <span>KES {pricing.vat.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                  <span>Estimated Total</span>
                  <span>KES {pricing.total.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="order-zone">Service Zone *</Label>
              <Select value={form.zone} onValueChange={(v) => setForm({ ...form, zone: v })}>
                <SelectTrigger id="order-zone"><SelectValue placeholder="Select your zone..." /></SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Service Type */}
            <div>
              <Label>Service Type</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  className={cn("p-3 rounded-lg border text-left text-sm transition-colors",
                    serviceType === 'standard' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/30'
                  )}
                  onClick={() => setServiceType('standard')}
                >
                  <p className="font-medium">Standard</p>
                  <p className="text-xs text-muted-foreground">24 hours</p>
                </button>
                <button
                  type="button"
                  className={cn("p-3 rounded-lg border text-left text-sm transition-colors",
                    serviceType === 'express' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/30'
                  )}
                  onClick={() => setServiceType('express')}
                >
                  <p className="font-medium">Express</p>
                  <p className="text-xs text-muted-foreground">
                    {loyaltyTier === 'platinum' ? 'Free - Platinum perk' : `+KES ${EXPRESS_SURCHARGE}`}
                  </p>
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="order-pickup-date">Preferred Pickup Date *</Label>
              <Input
                id="order-pickup-date"
                type="date"
                min={minDateStr}
                value={form.pickupDate}
                onChange={(e) => setForm({ ...form, pickupDate: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="order-address">Pickup Address *</Label>
              {savedAddresses.length > 0 && (
                <Select
                  value=""
                  onValueChange={(addrId) => {
                    const addr = savedAddresses.find((a: Address) => a.id === addrId);
                    if (addr) {
                      setForm({ ...form, pickupAddress: addr.addressLine, zone: addr.zone, pickupLat: addr.latitude, pickupLng: addr.longitude });
                    }
                  }}
                >
                  <SelectTrigger className="mb-2">
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
              )}
              <div className="relative">
                <Input
                  id="order-address"
                  value={form.pickupAddress}
                  onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })}
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

            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">What happens next?</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Admin reviews your request</li>
                <li>A driver is assigned and contacts you</li>
                <li>Driver picks up your items</li>
                <li>Items cleaned at our warehouse (2–3 days)</li>
                <li>Items delivered back to you</li>
              </ol>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-semibold">Order Placed Successfully!</p>
              <p className="text-muted-foreground text-sm mt-1">Your tracking code is:</p>
              <p className="text-2xl font-bold text-primary mt-1">{trackingCode}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              A driver will be assigned shortly. You can track your order at any time using the code above.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button disabled={!canProceedStep1} onClick={() => setStep(2)}>Next: Pickup Details →</Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button
                disabled={!form.zone || !form.pickupDate || !form.pickupAddress || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Placing...</> : 'Place Order'}
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="outline" onClick={handleClose}>Close</Button>
              <Button onClick={() => { handleClose(); navigate(`/portal/orders/${trackingCode}`); }}>
                Track Order
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Location Picker Modal */}
      <LocationPickerModal
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        onSelect={({ address, lat, lng }) => {
          setForm((prev) => ({ ...prev, pickupAddress: address, pickupLat: lat, pickupLng: lng }));
        }}
        initialCenter={form.pickupLat && form.pickupLng ? { lat: form.pickupLat, lng: form.pickupLng } : undefined}
        initialAddress={form.pickupAddress}
      />
    </Dialog>
  );
};
