import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/config/routes';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  MapPin,
  Calendar,
  Clock,
  Package,
  CheckCircle2,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  type: string;
  name: string;
  quantity: number;
  notes: string;
}

interface OrderFormState {
  items: OrderItem[];
  pickupAddress: string;
  zone: string;
  pickupDate: string;
  pickupTimeSlot: string;
  deliveryAddress: string;
  deliveryNotes: string;
  sameAsPickup: boolean;
}

const ITEM_TYPES = [
  'Carpet',
  'Rug',
  'Curtain',
  'Sofa',
  'Mattress',
  'Chair',
  'Cushion',
  'Duvet',
  'Blanket',
  'Car Seat Cover',
] as const;

const ZONES = ['Kitengela', 'Athi River', 'Nairobi', 'Syokimau', 'Mlolongo'] as const;

const TIME_SLOTS = [
  '8:00 AM - 10:00 AM',
  '10:00 AM - 12:00 PM',
  '12:00 PM - 2:00 PM',
  '2:00 PM - 4:00 PM',
  '4:00 PM - 6:00 PM',
] as const;

const STEPS = [
  { label: 'Items', icon: Package },
  { label: 'Pickup', icon: MapPin },
  { label: 'Review', icon: CheckCircle2 },
] as const;

const initialItem: OrderItem = { id: '1', type: '', name: '', quantity: 1, notes: '' };

const initialForm: OrderFormState = {
  items: [{ ...initialItem }],
  pickupAddress: '',
  zone: '',
  pickupDate: '',
  pickupTimeSlot: '',
  deliveryAddress: '',
  deliveryNotes: '',
  sameAsPickup: true,
};

interface PlaceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlaceOrderDialog({ open, onOpenChange }: PlaceOrderDialogProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OrderFormState>({ ...initialForm, items: [{ ...initialItem }] });
  const [submitting, setSubmitting] = useState(false);

  const resetDialog = useCallback(() => {
    setStep(0);
    setForm({ ...initialForm, items: [{ ...initialItem, id: String(Date.now()) }] });
    setSubmitting(false);
  }, []);

  const handleClose = useCallback((isOpen: boolean) => {
    if (!isOpen) resetDialog();
    onOpenChange(isOpen);
  }, [onOpenChange, resetDialog]);

  // Auth gate - if not authenticated, show sign-in prompt
  if (!isAuthenticated) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Sign in to place an order</DialogTitle>
            <DialogDescription>
              You need an account to schedule a pickup. Sign in or create a free account to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                handleClose(false);
                navigate(ROUTES.SIGN_IN, { state: { from: '/portal/dashboard' } });
              }}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => {
                handleClose(false);
                navigate(ROUTES.SIGN_UP);
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Create Account
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Free account. No credit card required.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  // Item management
  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { id: String(Date.now()), type: '', name: '', quantity: 1, notes: '' }],
    }));
  };

  const removeItem = (id: string) => {
    if (form.items.length <= 1) return;
    setForm((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }));
  };

  const updateItem = (id: string, field: keyof OrderItem, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    }));
  };

  // Validation
  const validateStep0 = () => {
    return form.items.every((item) => item.type && item.name.trim() && item.quantity > 0);
  };

  const validateStep1 = () => {
    return form.pickupAddress.trim() && form.zone && form.pickupDate && form.pickupTimeSlot;
  };

  const canProceed = step === 0 ? validateStep0() : step === 1 ? validateStep1() : true;

  const handleNext = () => {
    if (!canProceed) {
      toast.error(step === 0 ? 'Please fill in all item details' : 'Please fill in all pickup details');
      return;
    }
    setStep((s) => Math.min(s + 1, 2));
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Generate a tracking code
      const trackingCode = `EW-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
      toast.success(`Order placed! Tracking code: ${trackingCode}`, { duration: 6000 });
      handleClose(false);
    } catch {
      toast.error('Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Get tomorrow's date as min for pickup
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Schedule a Pickup</DialogTitle>
          <DialogDescription>
            {step === 0 && 'Add the items you want cleaned'}
            {step === 1 && 'Set your pickup location and time'}
            {step === 2 && 'Review your order before submitting'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  i === step && 'bg-primary text-primary-foreground',
                  i < step && 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20',
                  i > step && 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                <s.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn('w-8 h-0.5', i < step ? 'bg-primary' : 'bg-muted')} />
              )}
            </div>
          ))}
        </div>

        <Separator />

        {/* Step 0: Items */}
        {step === 0 && (
          <div className="space-y-4">
            {form.items.map((item, idx) => (
              <div key={item.id} className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Item {idx + 1}</span>
                  {form.items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={item.type}
                      onValueChange={(v) => updateItem(item.id, 'type', v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Name / Description</Label>
                    <Input
                      className="mt-1"
                      placeholder="e.g. Living Room Carpet"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      min={1}
                      max={20}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, Number(e.target.value)))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Special Notes</Label>
                    <Input
                      className="mt-1"
                      placeholder="Optional"
                      value={item.notes}
                      onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" className="w-full" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" />
              Add Another Item
            </Button>
          </div>
        )}

        {/* Step 1: Pickup Details */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="pickup-address">Pickup Address</Label>
              <Textarea
                id="pickup-address"
                className="mt-1"
                placeholder="Full address for pickup"
                value={form.pickupAddress}
                onChange={(e) => setForm((prev) => ({ ...prev, pickupAddress: e.target.value }))}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="pickup-zone">Zone</Label>
              <Select
                value={form.zone}
                onValueChange={(v) => setForm((prev) => ({ ...prev, zone: v }))}
              >
                <SelectTrigger id="pickup-zone" className="mt-1">
                  <SelectValue placeholder="Select your zone" />
                </SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pickup-date">
                  <Calendar className="inline h-3.5 w-3.5 mr-1" />
                  Pickup Date
                </Label>
                <Input
                  id="pickup-date"
                  type="date"
                  className="mt-1"
                  min={minDate}
                  value={form.pickupDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, pickupDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="pickup-time">
                  <Clock className="inline h-3.5 w-3.5 mr-1" />
                  Time Slot
                </Label>
                <Select
                  value={form.pickupTimeSlot}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, pickupTimeSlot: v }))}
                >
                  <SelectTrigger id="pickup-time" className="mt-1">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="delivery-notes">Delivery Notes (Optional)</Label>
              <Textarea
                id="delivery-notes"
                className="mt-1"
                placeholder="Any special instructions for pickup/delivery"
                value={form.deliveryNotes}
                onChange={(e) => setForm((prev) => ({ ...prev, deliveryNotes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Items Summary */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Items ({form.items.length})
              </h3>
              <div className="space-y-2">
                {form.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded border text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{item.type}</Badge>
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="text-muted-foreground">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Pickup Summary */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Pickup Details
              </h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">Address</span>
                <span className="font-medium">{form.pickupAddress}</span>

                <span className="text-muted-foreground">Zone</span>
                <span className="font-medium">{form.zone}</span>

                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{form.pickupDate}</span>

                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">{form.pickupTimeSlot}</span>
              </div>
              {form.deliveryNotes && (
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">Notes: </span>
                  <span>{form.deliveryNotes}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm text-center">
              A quote will be sent to you after our team inspects the items.
              You can track your order from your dashboard.
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          )}

          {step < 2 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className="w-full sm:w-auto"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              {submitting ? 'Placing Order...' : 'Place Order'}
              {!submitting && <CheckCircle2 className="ml-2 h-4 w-4" />}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
