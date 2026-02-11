import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { DollarSign, Truck, Package, TrendingUp, Save, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { PRICING } from '@/services/orderService';
import { getPricingConfig, updatePricingConfig, type PricingConfig } from '@/services/pricingService';
import { useAuth } from '@/hooks/useAuth';

const PricingManagement = () => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  // Check if user is super_admin
  const isSuperAdmin = user?.role === 'super_admin';

  // Fetch current pricing from backend
  const { data: pricingData, isLoading, refetch } = useQuery({
    queryKey: ['pricing', 'config'],
    queryFn: getPricingConfig,
  });

  // Item Pricing State
  const [itemPrices, setItemPrices] = useState({
    carpet: PRICING.pricePerSqInch.carpet,
    rug: PRICING.pricePerSqInch.rug,
    curtain: PRICING.pricePerSqInch.curtain,
    sofa: PRICING.pricePerSqInch.sofa,
    mattress: PRICING.pricePerSqInch.mattress,
    chair: PRICING.pricePerSqInch.chair,
    pillow: PRICING.pricePerSqInch.pillow,
    other: PRICING.pricePerSqInch.other,
  });

  // Delivery Fees State
  const [deliveryFees, setDeliveryFees] = useState({
    kitengela: PRICING.deliveryFees.kitengela,
    'athi river': PRICING.deliveryFees['athi river'],
    syokimau: PRICING.deliveryFees.syokimau,
    nairobi: PRICING.deliveryFees.nairobi,
    other: PRICING.deliveryFees.other,
  });

  // Other Settings State
  const [vatRate, setVatRate] = useState(PRICING.vatRate * 100); // Convert to percentage
  const [minimumOrder, setMinimumOrder] = useState(PRICING.minimumOrder);

  // Load pricing from backend when available
  useEffect(() => {
    if (pricingData?.success && pricingData.config) {
      const config = pricingData.config;
      setItemPrices(config.pricePerSqInch);
      setDeliveryFees(config.deliveryFees);
      setVatRate(config.vatRate * 100);
      setMinimumOrder(config.minimumOrder);
    }
  }, [pricingData]);

  const handleSaveAll = async () => {
    if (!isSuperAdmin) {
      toast.error('Unauthorized', {
        description: 'Only super admins can modify pricing configuration',
      });
      return;
    }

    if (!user) {
      toast.error('Authentication required');
      return;
    }

    setSaving(true);

    const config: PricingConfig = {
      pricePerSqInch: itemPrices,
      deliveryFees,
      vatRate: vatRate / 100,
      minimumOrder,
    };

    const result = await updatePricingConfig(config, user.id);
    setSaving(false);

    if (result.success) {
      toast.success('Pricing updated successfully!', {
        description: 'Changes will take effect immediately for new orders.',
      });
      refetch();
    } else if (result.errors) {
      toast.error('Validation failed', {
        description: result.errors.join('\n'),
      });
    } else {
      toast.error('Failed to update pricing', {
        description: result.message,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pricing Management"
          description="Configure pricing for items, delivery, and system-wide settings"
        />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing Management"
        description="Configure pricing for items, delivery, and system-wide settings"
      >
        {isSuperAdmin && (
          <Button onClick={handleSaveAll} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save All Changes
              </>
            )}
          </Button>
        )}
      </PageHeader>

      {!isSuperAdmin && (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to modify pricing. Only super admins can change pricing configuration.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items" className="gap-2">
            <Package className="w-4 h-4" />
            Item Pricing
          </TabsTrigger>
          <TabsTrigger value="delivery" className="gap-2">
            <Truck className="w-4 h-4" />
            Delivery Fees
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            General Settings
          </TabsTrigger>
        </TabsList>

        {/* Item Pricing Tab */}
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Price Per Square Inch
              </CardTitle>
              <CardDescription>
                Set the base price per square inch for different item types (in KES)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(itemPrices).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key} className="capitalize">
                      {key}
                    </Label>
                    <Input
                      id={key}
                      type="number"
                      step="0.05"
                      min="0.1"
                      value={value}
                      onChange={(e) =>
                        setItemPrices({ ...itemPrices, [key]: parseFloat(e.target.value) || 0 })
                      }
                      className="font-mono"
                      disabled={!isSuperAdmin}
                    />
                  </div>
                ))}
              </div>
              {!isSuperAdmin && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Read-only: Only super admins can modify prices
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delivery Fees Tab */}
        <TabsContent value="delivery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Delivery Fees by Zone
              </CardTitle>
              <CardDescription>
                Configure delivery fees for different zones (in KES)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(deliveryFees).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`delivery-${key}`} className="capitalize">
                      {key}
                    </Label>
                    <Input
                      id={`delivery-${key}`}
                      type="number"
                      step="50"
                      min="100"
                      value={value}
                      onChange={(e) =>
                        setDeliveryFees({ ...deliveryFees, [key]: parseFloat(e.target.value) || 0 })
                      }
                      className="font-mono"
                      disabled={!isSuperAdmin}
                    />
                  </div>
                ))}
              </div>
              {!isSuperAdmin && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Read-only: Only super admins can modify delivery fees
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Settings Tab */}
        <TabsContent value="general" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>VAT Rate</CardTitle>
                <CardDescription>
                  Configure the VAT (Value Added Tax) percentage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vat">VAT Percentage (%)</Label>
                  <Input
                    id="vat"
                    type="number"
                    step="0.5"
                    min="0"
                    max="30"
                    value={vatRate}
                    onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                    className="font-mono"
                    disabled={!isSuperAdmin}
                  />
                  <p className="text-xs text-muted-foreground">
                    Currently: {vatRate}% VAT will be added to orders
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Minimum Order</CardTitle>
                <CardDescription>
                  Set the minimum order amount required
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="minimum">Minimum Order Amount (KES)</Label>
                  <Input
                    id="minimum"
                    type="number"
                    step="50"
                    min="100"
                    value={minimumOrder}
                    onChange={(e) => setMinimumOrder(parseFloat(e.target.value) || 0)}
                    className="font-mono"
                    disabled={!isSuperAdmin}
                  />
                  <p className="text-xs text-muted-foreground">
                    Orders below KES {minimumOrder.toLocaleString()} will be rejected
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {!isSuperAdmin && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Read-only: Only super admins can modify settings
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Pricing Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Preview</CardTitle>
          <CardDescription>
            Example calculation for a 60x40 inch carpet in Nairobi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Carpet (60 x 40 = 2400 sq inches)</span>
              <span className="font-mono">
                2400 × {itemPrices.carpet} = KES {Math.round(2400 * itemPrices.carpet)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery (Nairobi)</span>
              <span className="font-mono">+ KES {deliveryFees.nairobi}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">
                = KES {Math.round(2400 * itemPrices.carpet) + deliveryFees.nairobi}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT ({vatRate}%)</span>
              <span className="font-mono">
                + KES{' '}
                {Math.round(
                  (Math.round(2400 * itemPrices.carpet) + deliveryFees.nairobi) * (vatRate / 100)
                )}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t font-semibold">
              <span>Total</span>
              <span className="font-mono text-lg">
                KES{' '}
                {Math.round(
                  Math.round(2400 * itemPrices.carpet) +
                    deliveryFees.nairobi +
                    (Math.round(2400 * itemPrices.carpet) + deliveryFees.nairobi) * (vatRate / 100)
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PricingManagement;
