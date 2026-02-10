import { useState } from 'react';
import { PageHeader, DataTable, KPICard } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Package,
  ScanBarcode,
  Camera,
  ClipboardList,
  Clock,
  Plus,
} from 'lucide-react';

const mockIntakes = [
  { id: '1', orderNumber: 'EW-2025-00412', item: 'Living Room Carpet', type: 'Carpet', condition: 'Heavily soiled, pet stains', receivedBy: 'Mercy Wangari', time: '08:15 AM' },
  { id: '2', orderNumber: 'EW-2025-00412', item: 'Persian Rug', type: 'Rug', condition: 'Light soiling, good condition', receivedBy: 'Mercy Wangari', time: '08:18 AM' },
  { id: '3', orderNumber: 'EW-2025-00408', item: 'Sofa (3-Seater)', type: 'Sofa', condition: 'Food stains on cushions', receivedBy: 'Kevin Omondi', time: '09:00 AM' },
  { id: '4', orderNumber: 'EW-2025-00415', item: 'Carpet (Medium)', type: 'Carpet', condition: 'Mud stains, frayed edges', receivedBy: 'Mercy Wangari', time: '09:45 AM' },
  { id: '5', orderNumber: 'EW-2025-00415', item: 'Carpet (Small)', type: 'Carpet', condition: 'General dust, good condition', receivedBy: 'Mercy Wangari', time: '09:48 AM' },
  { id: '6', orderNumber: 'EW-2025-00420', item: 'Curtain Pair (Long)', type: 'Curtain', condition: 'Smoke smell, yellowing', receivedBy: 'Kevin Omondi', time: '10:30 AM' },
  { id: '7', orderNumber: 'EW-2025-00420', item: 'Curtain Pair (Short)', type: 'Curtain', condition: 'Light dust only', receivedBy: 'Kevin Omondi', time: '10:32 AM' },
  { id: '8', orderNumber: 'EW-2025-00425', item: 'Mattress (King)', type: 'Mattress', condition: 'Sweat stains, needs deep clean', receivedBy: 'Mercy Wangari', time: '11:00 AM' },
  { id: '9', orderNumber: 'EW-2025-00425', item: 'Pillow (Set of 4)', type: 'Pillow', condition: 'Yellowing, flatten', receivedBy: 'Mercy Wangari', time: '11:05 AM' },
  { id: '10', orderNumber: 'EW-2025-00430', item: 'Office Rug', type: 'Rug', condition: 'High traffic wear, coffee spills', receivedBy: 'Kevin Omondi', time: '11:30 AM' },
];

const intakeColumns: Column<(typeof mockIntakes)[0]>[] = [
  { key: 'orderNumber', header: 'Order #', sortable: true },
  { key: 'item', header: 'Item', sortable: true },
  {
    key: 'type',
    header: 'Type',
    render: (row) => <Badge variant="outline">{row.type}</Badge>,
  },
  {
    key: 'condition',
    header: 'Condition',
    render: (row) => (
      <span className="text-sm line-clamp-1 max-w-xs">{row.condition}</span>
    ),
  },
  { key: 'receivedBy', header: 'Received By' },
  { key: 'time', header: 'Time', sortable: true },
];

export const ItemIntake = () => {
  const [form, setForm] = useState({
    orderId: '',
    barcode: '',
    itemType: '',
    conditionNotes: '',
  });

  const handleSubmitIntake = () => {
    setForm({ orderId: '', barcode: '', itemType: '', conditionNotes: '' });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Item Intake" description="Receive and log incoming items" />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard
          label="Items Received Today"
          value={mockIntakes.length}
          change={8}
          changeDirection="up"
          icon={Package}
        />
        <KPICard
          label="Pending Processing"
          value={6}
          change={-2}
          changeDirection="down"
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New Intake Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              New Intake
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="intake-order">Order ID</Label>
              <Input
                id="intake-order"
                value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                placeholder="e.g. EW-2025-00430"
              />
            </div>

            <div>
              <Label htmlFor="intake-barcode">Scan Barcode</Label>
              <div className="flex gap-2">
                <Input
                  id="intake-barcode"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="Scan or enter barcode"
                />
                <Button variant="outline" size="icon">
                  <ScanBarcode className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="intake-type">Item Type</Label>
              <Select value={form.itemType} onValueChange={(v) => setForm({ ...form, itemType: v })}>
                <SelectTrigger id="intake-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Carpet">Carpet</SelectItem>
                  <SelectItem value="Rug">Rug</SelectItem>
                  <SelectItem value="Curtain">Curtain</SelectItem>
                  <SelectItem value="Sofa">Sofa</SelectItem>
                  <SelectItem value="Mattress">Mattress</SelectItem>
                  <SelectItem value="Pillow">Pillow</SelectItem>
                  <SelectItem value="Chair">Chair</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="intake-condition">Condition Notes</Label>
              <Textarea
                id="intake-condition"
                value={form.conditionNotes}
                onChange={(e) => setForm({ ...form, conditionNotes: e.target.value })}
                placeholder="Describe item condition..."
                rows={3}
              />
            </div>

            <div>
              <Label>Photo</Label>
              <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center mt-1">
                <Camera className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Capture item photo</p>
                <Button variant="outline" size="sm" className="mt-2">
                  <Camera className="mr-1 h-3 w-3" />
                  Take Photo
                </Button>
              </div>
            </div>

            <Separator />

            <Button className="w-full" onClick={handleSubmitIntake}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Log Intake
            </Button>
          </CardContent>
        </Card>

        {/* Recent Intakes Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Intakes</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={mockIntakes}
                columns={intakeColumns}
                searchable
                searchPlaceholder="Search items..."
                pageSize={8}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ItemIntake;
