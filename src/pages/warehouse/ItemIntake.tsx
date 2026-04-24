import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Package, Clock, ClipboardList, Plus, Loader2, Camera, X, Search, MapPin, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getIntakeQueue } from '@/services/warehouseService';
import { supabase } from '@/lib/supabase';
import { IntakeItem } from '@/types';

interface OrderResult {
  id: string;
  tracking_code: string;
  customer_name: string | null;
  zone: string | null;
  service_type: string | null;
  notes: string | null;
  order_items: { name: string; item_type: string; quantity: number }[];
}

export const ItemIntake = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Order search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OrderResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderResult | null>(null);

  const { data: intakes = [], isLoading } = useQuery({
    queryKey: ['warehouse', 'intake'],
    queryFn: getIntakeQueue,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchOrders = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, tracking_code, customer_name, zone, service_type, notes, order_items(name, item_type, quantity)')
        .or(`tracking_code.ilike.%${query}%,customer_name.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(8);

      if (!error && data) {
        setSearchResults(data as OrderResult[]);
        setShowDropdown(true);
      }
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    setSelectedOrder(null);
    setForm((prev) => ({ ...prev, orderId: '', orderNumber: '', customerName: '' }));

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchOrders(value), 300);
  };

  const selectOrder = (order: OrderResult) => {
    setSelectedOrder(order);
    setSearchQuery(order.tracking_code);
    setShowDropdown(false);

    // Auto-fill from order + first order item if available
    const firstItem = order.order_items[0];
    setForm((prev) => ({
      ...prev,
      orderId: order.id,
      orderNumber: order.tracking_code,
      customerName: order.customer_name ?? '',
      itemName: firstItem?.name ?? prev.itemName,
      itemType: firstItem?.item_type ?? prev.itemType,
      quantity: firstItem?.quantity ?? prev.quantity,
    }));
  };

  const clearOrder = () => {
    setSelectedOrder(null);
    setSearchQuery('');
    setSearchResults([]);
    setForm((prev) => ({ ...prev, orderId: '', orderNumber: '', customerName: '' }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    const ext = imageFile.name.split('.').pop() ?? 'jpg';
    const path = `intake/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from('warehouse-images')
      .upload(path, imageFile, { contentType: imageFile.type });
    if (error) {
      console.error('Image upload failed:', error);
      return null;
    }
    const { data: urlData } = supabase.storage
      .from('warehouse-images')
      .getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSubmitIntake = async () => {
    if (!form.orderNumber || !form.customerName || !form.itemName || !form.itemType) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!form.orderId) {
      toast.error('Search for an order and select it before logging intake');
      return;
    }

    setSubmitting(true);
    try {
      const imageUrl = await uploadImage();
      const { error } = await supabase.from('warehouse_intake').insert({
        order_id: form.orderId,
        order_number: form.orderNumber,
        customer_name: form.customerName,
        item_name: form.itemName,
        item_type: form.itemType,
        quantity: form.quantity,
        condition_notes: form.conditionNotes || null,
        warehouse_location: form.warehouseLocation || null,
        received_at: new Date().toISOString(),
        received_by: user?.name ?? 'Warehouse Staff',
        image_url: imageUrl,
      });
      if (error) {
        toast.error('Failed to log intake: ' + error.message);
      } else {
        await supabase.from('warehouse_processing').insert({
          order_id: form.orderId,
          order_number: form.orderNumber,
          customer_name: form.customerName,
          item_name: form.itemName,
          item_type: form.itemType,
          quantity: form.quantity,
          stage: 'intake',
          warehouse_location: form.warehouseLocation || 'Unassigned',
          started_at: new Date().toISOString(),
        });
        await supabase.from('orders').update({ status: 4, updated_at: new Date().toISOString() }).eq('id', form.orderId);
        toast.success(`Item logged: ${form.itemName} for ${form.orderNumber}`);
        setForm({ orderId: '', orderNumber: '', customerName: '', itemName: '', itemType: '', quantity: 1, conditionNotes: '', warehouseLocation: '' });
        clearImage();
        clearOrder();
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
    {
      key: 'imageUrl',
      header: 'Photo',
      render: (row) =>
        row.imageUrl ? (
          <a href={row.imageUrl} target="_blank" rel="noopener noreferrer">
            <img src={row.imageUrl} alt={row.itemName} className="w-10 h-10 rounded object-cover border" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    { key: 'conditionNotes', header: 'Condition', render: (row) => <span className="text-sm line-clamp-1 max-w-xs">{row.conditionNotes || '—'}</span> },
    { key: 'receivedBy', header: 'Received By' },
    { key: 'receivedAt', header: 'Time', render: (row) => <span className="text-xs">{new Date(row.receivedAt).toLocaleTimeString()}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Item Intake" description="Receive and log incoming items" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard label="Total Intake Records" value={intakes.length} icon={Package} />
        <KPICard
          label="Received Today"
          value={intakes.filter((i) => new Date(i.receivedAt).toDateString() === new Date().toDateString()).length}
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Plus className="h-5 w-5" />New Intake</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Order search */}
            <div ref={searchRef} className="relative">
              <Label>Find Order *</Label>
              {selectedOrder ? (
                <div className="mt-1 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{selectedOrder.tracking_code}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{selectedOrder.customer_name || 'No name'}</span>
                        {selectedOrder.zone && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{selectedOrder.zone}</span>}
                      </div>
                      {selectedOrder.order_items.length > 0 && (
                        <p className="text-xs text-primary mt-1">
                          Items: {selectedOrder.order_items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                      )}
                      {selectedOrder.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{selectedOrder.notes}"</p>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={clearOrder}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                      placeholder="Search by tracking code or customer name..."
                      className="pl-9"
                    />
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>

                  {showDropdown && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-[320px] overflow-y-auto">
                      {searchResults.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          {searchQuery.length < 2 ? 'Type at least 2 characters...' : 'No orders found'}
                        </div>
                      ) : (
                        searchResults.map((order) => (
                          <button
                            key={order.id}
                            type="button"
                            className="w-full text-left p-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                            onClick={() => selectOrder(order)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{order.tracking_code}</span>
                              {order.service_type && (
                                <Badge variant="outline" className="text-[10px] capitalize">{order.service_type}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><User className="h-3 w-3" />{order.customer_name || 'Unknown'}</span>
                              {order.zone && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{order.zone}</span>}
                            </div>
                            {order.order_items.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {order.order_items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                              </p>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <Label>Customer Name *</Label>
              <Input
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="Customer name"
                readOnly={!!selectedOrder?.customer_name}
                className={selectedOrder?.customer_name ? 'bg-muted' : ''}
              />
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

            {/* Image upload */}
            <div>
              <Label>Item Photo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative mt-2 inline-block">
                  <img src={imagePreview} alt="Preview" className="w-full max-w-[200px] rounded-lg border object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={clearImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo / Upload
                </Button>
              )}
            </div>

            <Separator />
            <Button className="w-full" onClick={handleSubmitIntake} disabled={submitting || !form.orderId}>
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
