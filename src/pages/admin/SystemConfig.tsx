import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, DollarSign, MapPin, Clock, Building2, Truck } from 'lucide-react';
import { toast } from 'sonner';

const handleSave = (section: string) => {
  toast.success(`${section} saved successfully`);
};

/**
 * Admin System Configuration Page
 * Tabs: General, Zones, Pricing, Business Hours.
 * Save Changes button with success toast.
 */
export const SystemConfig = () => {
  return (
    <div className="space-y-6">
      <PageHeader title="System Configuration" description="Manage application settings and business rules" />

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="hours">Business Hours</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input defaultValue="Express Carpets &amp; Upholstery" />
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input defaultValue="Professional Carpet & Fabric Care" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input defaultValue="+254 712 345 678" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input defaultValue="info@expresscarpets.co.ke" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea defaultValue="Kitengela, Kenya" rows={2} />
              </div>
              <Button size="sm" onClick={() => handleSave('Company info')}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                Delivery Policies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { key: 'free-delivery', title: 'Free Pickup & Delivery', desc: 'Include in price', defaultChecked: true },
                  { key: 'same-day', title: 'Same-Day Service', desc: 'For Kitengela & Athi River', defaultChecked: true },
                  { key: 'weekend', title: 'Weekend Delivery', desc: 'Saturday & Sunday service', defaultChecked: true },
                  { key: 'cod', title: 'Cash on Delivery', desc: 'Accept cash payments', defaultChecked: true },
                ].map((policy) => (
                  <div key={policy.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{policy.title}</p>
                      <p className="text-xs text-muted-foreground">{policy.desc}</p>
                    </div>
                    <Switch defaultChecked={policy.defaultChecked} />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Max items per delivery</Label>
                <Input type="number" defaultValue="20" className="max-w-xs" />
              </div>
              <Button size="sm" onClick={() => handleSave('Delivery policies')}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zones Tab */}
        <TabsContent value="zones">
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Service Zones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { name: 'Kitengela', multiplier: '1.0', delivery: 'Same Day' },
                  { name: 'Athi River / Syokimau', multiplier: '1.0', delivery: 'Same Day' },
                  { name: 'Greater Nairobi', multiplier: '1.1', delivery: '48 Hours' },
                  { name: 'Westlands', multiplier: '1.15', delivery: '48 Hours' },
                  { name: 'Karen / Lavington', multiplier: '1.2', delivery: '72 Hours' },
                ].map((zone) => (
                  <div key={zone.name} className="p-3 border border-border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{zone.name}</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Price Multiplier</Label>
                        <Input type="number" defaultValue={zone.multiplier} className="h-8 text-sm" step="0.1" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Delivery Time</Label>
                        <Input defaultValue={zone.delivery} className="h-8 text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" onClick={() => handleSave('Service zones')}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing">
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Pricing Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Carpet (Small)', price: 500 },
                  { label: 'Carpet (Large)', price: 800 },
                  { label: 'Chair', price: 300 },
                  { label: 'Curtain Pair', price: 400 },
                  { label: 'Rug', price: 450 },
                  { label: 'Mattress', price: 600 },
                  { label: 'Sofa (2-Seater)', price: 800 },
                  { label: 'Sofa (3-Seater)', price: 1200 },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <Label>{item.label}</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">KES</span>
                      <Input type="number" defaultValue={item.price} className="pl-12" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 max-w-xs">
                <Label>VAT Rate (%)</Label>
                <Input type="number" defaultValue="16" />
              </div>
              <Button size="sm" onClick={() => handleSave('Pricing rules')}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Hours Tab */}
        <TabsContent value="hours">
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Business Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { day: 'Monday - Friday', open: '07:00', close: '19:00' },
                  { day: 'Saturday', open: '08:00', close: '17:00' },
                  { day: 'Sunday', open: '09:00', close: '14:00' },
                  { day: 'Public Holidays', open: '09:00', close: '14:00' },
                ].map((schedule) => (
                  <div key={schedule.day} className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium w-36">{schedule.day}</span>
                    <Input type="time" defaultValue={schedule.open} className="h-8 w-28 text-sm" />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input type="time" defaultValue={schedule.close} className="h-8 w-28 text-sm" />
                    <Switch defaultChecked />
                  </div>
                ))}
              </div>
              <Button size="sm" onClick={() => handleSave('Business hours')}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemConfig;
