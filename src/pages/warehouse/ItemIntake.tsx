import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Package, Clock, ClipboardList, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getIntakeQueue } from '@/services/warehouseService';
import { supabase } from '@/lib/supabase';
import { IntakeItem } from '@/types';

export const ItemIntake = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    orderId: '',
    orderNumber: '',
    customerName: '',
    itemName: '',
    itemType: '',
    quantity: 1,
    conditionNotes: '',
    warehouseLocation: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: intakes = [], isLoading } = useQuery({
    queryKey: ['warehouse', 'intake'],
    queryFn: getIntakeQueue,
  });

  const handleSubmitIntake = async () => {
    if (!form.orderNumber || !form.customerName || !form.itemName || !form.itemType) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('warehouse_intake').insert({
        order_id: form.orderId || form.orderNumber,
        order_number: form.orderNumber,
        customer_name: form.customerName,
        item_name: form.itemName,
        item_type: form.itemType,
        quantity: form.quantity,
        condition_notes: form.conditionNotes || null,
        warehouse_location: form.warehouseLocation || null,
        received_at: new Date().toISOString(),
        received_by: user?.name ?? 'Warehouse Staff',
      });
      if (error) {
        toast.error('Failed to log intake: ' + error.message);
      } else {
        // Also create a processing entry
        await supabase.from('warehouse_processing').insert({
          order_id: form.orderId || form.orderNumber,
          order_number: form.orderNumber,
          customer_name: form.customerName,
          item_name: form.itemName,
          item_type: form.itemType,
          quantity: form.quantity,
          stage: 'intake',
          warehouse_location: form.warehouseLocation || 'Unassigned',
          started_at: new Date().toISOString(),
        });
        // Update order status to "at_warehouse" (4)
        await supabase.from('orders').update({ status: 4, updated_at: new Date().toISOString() }).eq('tracking_code', form.orderNumber);
        toast.success(`Item logged: ${form.itemName} for ${form.orderNumber}`);
        setForm({ orderId: '', orderNumber: '', customerName: '', itemName: '', itemType: '', quantity: 1, conditionNotes: '', warehouseLocation: '' });
        qc.invalidateQueries({ queryKey: ['warehouse', 'intake'] });
        qc.invalidateQueries({ queryKey: ['warehouse', 'processing'] });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const intakeColumns: Column<IntakeItem>[] = [
    { key: 'orderNumber', header: 'Order #', sortable: true },
    { key: 'itemName', header: 'Item', sortable: true },
    { key: 'itemType', header: 'Type', render: (row) => <Badge variant="outline">{row.itemType}</Badge> },
    { key: 'conditionNotes', header: 'Condition', render: (row) => <span className="text-sm line-clamp-1 max-w-xs">{row.conditionNotes || '—'}</span> },
    { key: 'receivedBy', header: 'Received By' },
    { key: 'receivedAt', header: 'Time', render: (row) => <span className="text-xs">{new Date(row.receivedAt).toLocaleTimeString()}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Item Intake" description="Receive and log incoming items" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard label="Items Received Today" value={intakes.length} icon={Package} />
        <KPICard label="Pending Processing" value={intakes.length} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Plus className="h-5 w-5" />New Intake</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="intake-order">Tracking Code *</Label>
              <Input id="intake-order" value={form.orderNumber} onChange={(e) => setForm({ ...form, orderNumber: e.target.value })} placeholder="e.g. EW-2025-00430" />
            </div>
            <div>
              <Label>Customer Name *</Label>
              <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Customer name" />
            </div>
            <div>
              <Label>Item Name *</Label>
              <Input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder="e.g. Living Room Carpet" />
            </div>
            <div>
              <Label>Item Type *</Label>
              <Select value={form.itemType} onValueChange={(v) => setForm({ ...form, itemType: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {['Carpet', 'Rug', 'Curtain', 'Sofa', 'Mattress', 'Pillow', 'Chair', 'Duvet', 'Other'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Warehouse Location</Label>
              <Input value={form.warehouseLocation} onChange={(e) => setForm({ ...form, warehouseLocation: e.target.value })} placeholder="e.g. Bay A-3" />
            </div>
            <div>
              <Label>Condition Notes</Label>
              <Textarea value={form.conditionNotes} onChange={(e) => setForm({ ...form, conditionNotes: e.target.value })} placeholder="Describe item condition..." rows={3} />
            </div>
            <Separator />
            <Button className="w-full" onClick={handleSubmitIntake} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
              {submitting ? 'Logging...' : 'Log Intake'}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-lg">Recent Intakes</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <DataTable data={intakes} columns={intakeColumns} searchable searchPlaceholder="Search items..." pageSize={8} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ItemIntake;
