import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, DataTable, StatusBadge, SearchInput, ExportButton } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Package, History, Plus, Phone, MessageSquare, Store, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getOrders, bulkUpdateOrderStatus, trackOrder, createOrder } from '@/services/orderService';
import { getDrivers } from '@/services/driverService';
import { assignDriverToOrder } from '@/services/orderService';
import { Order, OrderSource } from '@/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { OrderTimeline } from '@/components/admin/OrderTimeline';
import { getOrderStatusBadgeKey } from '@/constants/orderStatus';
import { useActiveZones } from '@/hooks/useZones';
import { PRICING, calculateItemPrice, calculateETA } from '@/services/orderService';

const STATUS_OPTIONS = [
  { value: '1', label: 'Pending' },
  { value: '2', label: 'Confirmed' },
  { value: '3', label: 'Driver Assigned' },
  { value: '4', label: 'Pickup Scheduled' },
  { value: '5', label: 'Picked Up' },
  { value: '6', label: 'In Processing' },
  { value: '7', label: 'Processing Complete' },
  { value: '8', label: 'Quality Check' },
  { value: '9', label: 'Quality Approved' },
  { value: '10', label: 'Ready for Delivery' },
  { value: '11', label: 'Out for Delivery' },
  { value: '12', label: 'Delivered' },
  { value: '13', label: 'Cancelled' },
  { value: '14', label: 'Refunded' },
];

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

interface NewOrderForm {
  customerName: string;
  customerPhone: string;
  zone: string;
  pickupAddress: string;
  notes: string;
  items: Array<{ name: string; itemType: string; quantity: number; lengthInches: string; widthInches: string }>;
}

function emptyForm(): NewOrderForm {
  return {
    customerName: '',
    customerPhone: '',
    zone: '',
    pickupAddress: '',
    notes: '',
    items: [{ name: '', itemType: '', quantity: 1, lengthInches: '', widthInches: '' }],
  };
}

const SOURCE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  app: { label: 'App', icon: Package, color: 'bg-blue-100 text-blue-700' },
  walkin: { label: 'Walk-in', icon: Store, color: 'bg-green-100 text-green-700' },
  call: { label: 'Call', icon: Phone, color: 'bg-orange-100 text-orange-700' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'bg-emerald-100 text-emerald-700' },
};

export const OrderManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [assignDialogOrder, setAssignDialogOrder] = useState<Order | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [trackDialogOpen, setTrackDialogOpen] = useState(false);
  const [trackingCodeInput, setTrackingCodeInput] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [timelineOrder, setTimelineOrder] = useState<Order | null>(null);
  const [createDialogSource, setCreateDialogSource] = useState<OrderSource | null>(null);
  const [createForm, setCreateForm] = useState<NewOrderForm>(emptyForm());
  const [isCreating, setIsCreating] = useState(false);

  const { data: activeZones = [] } = useActiveZones();

  const { data: result, isLoading } = useQuery({
    queryKey: ['admin', 'orders', statusFilter, search, page],
    queryFn: () =>
      getOrders({
        status: statusFilter !== 'all' ? Number(statusFilter) : undefined,
        search: search || undefined,
        page,
        limit: 15,
      }),
    keepPreviousData: true,
  } as Parameters<typeof useQuery>[0]);

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers', 'list'],
    queryFn: getDrivers,
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: number }) =>
      bulkUpdateOrderStatus(ids, status),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Updated ${data.updated} order${data.updated !== 1 ? 's' : ''}`);
        setSelectedIds(new Set());
        setBulkStatus('');
        qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      } else {
        toast.error('Failed to update orders', { description: data.error ?? 'Please try again' });
      }
    },
    onError: (err: Error) => {
      toast.error('Failed to update orders', { description: err.message });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ orderId, driverId }: { orderId: string; driverId: string }) => {
      const driver = drivers.find((d) => d.id === driverId);
      if (!driver) throw new Error('Driver not found');
      return assignDriverToOrder(orderId, driverId, driver.name, driver.phone);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Driver assigned successfully');
        setAssignDialogOrder(null);
        setSelectedDriverId('');
        qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      } else {
        toast.error(data.error ?? 'Failed to assign driver');
      }
    },
  });

  const orders = result?.data ?? [];

  const handleTrackOrder = async () => {
    const code = trackingCodeInput.trim();
    if (!code) { toast.error('Please enter a tracking code'); return; }
    const trackingCodeRegex = /^EW-\d{4}-\d{5}$/i;
    if (!trackingCodeRegex.test(code)) {
      toast.error('Invalid tracking code format', { description: 'Format: EW-YYYY-NNNNN' });
      return;
    }
    setTrackLoading(true);
    setTrackedOrder(null);
    try {
      const result = await trackOrder(code);
      if (result.success && result.order) {
        setTrackedOrder(result.order);
        toast.success('Order found!');
      } else {
        toast.error(result.error || 'Order not found');
      }
    } catch {
      toast.error('Failed to track order');
    } finally {
      setTrackLoading(false);
    }
  };

  const updateFormItem = (idx: number, field: string, value: string | number) => {
    setCreateForm((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, items };
    });
  };

  const addFormItem = () => {
    setCreateForm((prev) => ({
      ...prev,
      items: [...prev.items, { name: '', itemType: '', quantity: 1, lengthInches: '', widthInches: '' }],
    }));
  };

  const removeFormItem = (idx: number) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== idx) : prev.items,
    }));
  };

  const handleCreateOrder = async () => {
    if (!createDialogSource) return;
    if (!createForm.customerName.trim() || !createForm.zone || !createForm.pickupAddress.trim()) {
      toast.error('Please fill in customer name, zone, and address');
      return;
    }
    const validItems = createForm.items.filter(
      (i) => i.name.trim() && i.itemType && parseFloat(i.lengthInches) > 0 && parseFloat(i.widthInches) > 0,
    );
    if (validItems.length === 0) {
      toast.error('Please add at least one item with valid dimensions');
      return;
    }

    setIsCreating(true);
    try {
      const pricedItems = validItems.map((i) => {
        const l = parseFloat(i.lengthInches);
        const w = parseFloat(i.widthInches);
        const calc = calculateItemPrice(i.itemType, l, w, i.quantity);
        return {
          name: i.name,
          itemType: i.itemType,
          quantity: i.quantity,
          lengthInches: l,
          widthInches: w,
          pricePerSqInch: calc.pricePerSqInch,
          unitPrice: calc.unitPrice,
          totalPrice: calc.totalPrice,
        };
      });

      const subtotal = pricedItems.reduce((s, i) => s + i.totalPrice, 0);
      const zone = activeZones.find((z) => z.name === createForm.zone);
      const deliveryFee = zone?.base_delivery_fee ?? 300;
      const vat = Math.round((subtotal + deliveryFee) * PRICING.vatRate);
      const total = subtotal + deliveryFee + vat;

      // Walk-ins are already at the facility — use today's date as pickup
      const today = new Date().toISOString().split('T')[0];

      const result = await createOrder({
        customerId: 'admin-created',
        customerName: createForm.customerName,
        customerPhone: createForm.customerPhone || undefined,
        zone: createForm.zone,
        pickupAddress: createForm.pickupAddress,
        pickupDate: today,
        items: pricedItems,
        subtotal,
        deliveryFee,
        vat,
        total,
        notes: createForm.notes || undefined,
        orderSource: createDialogSource,
        skipServerPricing: true,
      });

      if (result.success) {
        toast.success(`${createDialogSource === 'walkin' ? 'Walk-in' : 'Order'} created — ${result.order?.trackingCode}`);
        setCreateDialogSource(null);
        setCreateForm(emptyForm());
        qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      } else {
        toast.error(result.error ?? 'Failed to create order');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const columns: Column<Order>[] = [
    {
      key: 'id',
      header: '',
      className: 'w-10',
      render: (row) => (
        <Checkbox
          checked={selectedIds.has(row.id ?? '')}
          onCheckedChange={() => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(row.id ?? '')) next.delete(row.id ?? '');
              else next.add(row.id ?? '');
              return next;
            });
          }}
        />
      ),
    },
    { key: 'trackingCode', header: 'Order ID', sortable: true },
    { key: 'customerName', header: 'Customer', sortable: true },
    {
      key: 'items',
      header: 'Items',
      render: (row) => (
        <span className="text-sm">{row.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={getOrderStatusBadgeKey(row.status)} />,
    },
    { key: 'zone', header: 'Zone', sortable: true },
    {
      key: 'orderSource',
      header: 'Source',
      render: (row) => {
        const src = SOURCE_LABELS[row.orderSource ?? 'app'] ?? SOURCE_LABELS.app;
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${src.color}`}>
            <src.icon className="h-3 w-3" />
            {src.label}
          </span>
        );
      },
    },
    {
      key: 'driverName',
      header: 'Driver',
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.driverName ?? '—'}</span>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="View Timeline"
            onClick={() => setTimelineOrder(row)}
          >
            <History className="w-4 h-4" />
          </Button>
          {row.status >= 1 && row.status <= 4 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setAssignDialogOrder(row)}
            >
              {row.driverName ? 'Reassign' : 'Assign Driver'}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Order Management" description="View, create, and manage all orders">
        <div className="flex gap-2">
          <Button onClick={() => { setCreateDialogSource('walkin'); setCreateForm(emptyForm()); }} variant="outline" className="gap-2">
            <Store className="w-4 h-4" />
            Walk-in
          </Button>
          <Button onClick={() => { setCreateDialogSource('call'); setCreateForm(emptyForm()); }} variant="outline" className="gap-2">
            <Phone className="w-4 h-4" />
            Call Order
          </Button>
          <Button onClick={() => { setCreateDialogSource('whatsapp'); setCreateForm(emptyForm()); }} variant="outline" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            WhatsApp Order
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setTrackDialogOpen(true)} variant="outline" className="gap-2">
          <Package className="w-4 h-4" />
          Track Order
        </Button>
        <SearchInput
          onSearch={useCallback((v: string) => { setSearch(v); setPage(1); }, [])}
          placeholder="Search orders..."
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ExportButton data={orders} filename="orders-export" />
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Change status to..." />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!bulkStatus || bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), status: Number(bulkStatus) })}
          >
            Update
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
        </div>
      ) : (
        <DataTable
          data={orders}
          columns={columns}
          searchable={false}
          pageSize={15}
          onRowClick={(row) => navigate(`/admin/orders/${row.trackingCode}`)}
        />
      )}

      {/* Create Order Dialog (Walk-in / Call / WhatsApp) */}
      <Dialog open={!!createDialogSource} onOpenChange={(open) => { if (!open) setCreateDialogSource(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {createDialogSource === 'walkin' && <><Store className="h-5 w-5" /> Create Walk-in Order</>}
              {createDialogSource === 'call' && <><Phone className="h-5 w-5" /> Create Call Order</>}
              {createDialogSource === 'whatsapp' && <><MessageSquare className="h-5 w-5" /> Create WhatsApp Order</>}
            </DialogTitle>
            <DialogDescription>
              {createDialogSource === 'walkin'
                ? 'Customer has brought items in person — goes straight to warehouse intake.'
                : 'Order created on behalf of customer — driver pickup will be assigned.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Name *</Label>
                <Input
                  value={createForm.customerName}
                  onChange={(e) => setCreateForm((p) => ({ ...p, customerName: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input
                  value={createForm.customerPhone}
                  onChange={(e) => setCreateForm((p) => ({ ...p, customerPhone: e.target.value }))}
                  placeholder="+254 7XX XXX XXX"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Zone *</Label>
                <Select value={createForm.zone} onValueChange={(v) => setCreateForm((p) => ({ ...p, zone: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeZones.map((z) => (
                      <SelectItem key={z.id} value={z.name}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{createDialogSource === 'walkin' ? 'Customer Address' : 'Pickup Address'} *</Label>
                <Input
                  value={createForm.pickupAddress}
                  onChange={(e) => setCreateForm((p) => ({ ...p, pickupAddress: e.target.value }))}
                  placeholder="Street / estate / landmark"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Special instructions..."
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Items</Label>
                <Button variant="outline" size="sm" onClick={addFormItem}>
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>
              {createForm.items.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Item {idx + 1}</span>
                    {createForm.items.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeFormItem(idx)}>Remove</Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Name *</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateFormItem(idx, 'name', e.target.value)}
                        placeholder="e.g. Living Room Carpet"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Type *</Label>
                      <Select value={item.itemType} onValueChange={(v) => updateFormItem(idx, 'itemType', v)}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {ITEM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Length (in) *</Label>
                      <Input type="number" min="1" value={item.lengthInches} onChange={(e) => updateFormItem(idx, 'lengthInches', e.target.value)} placeholder="120" />
                    </div>
                    <div>
                      <Label className="text-xs">Width (in) *</Label>
                      <Input type="number" min="1" value={item.widthInches} onChange={(e) => updateFormItem(idx, 'widthInches', e.target.value)} placeholder="84" />
                    </div>
                    <div>
                      <Label className="text-xs">Qty</Label>
                      <Input type="number" min="1" max="20" value={item.quantity} onChange={(e) => updateFormItem(idx, 'quantity', parseInt(e.target.value) || 1)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogSource(null)}>Cancel</Button>
            <Button onClick={handleCreateOrder} disabled={isCreating}>
              {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Track Order Dialog */}
      <Dialog open={trackDialogOpen} onOpenChange={(open) => { setTrackDialogOpen(open); if (!open) { setTrackingCodeInput(''); setTrackedOrder(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Track Order</DialogTitle>
            <DialogDescription>Enter a tracking code to view order details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter tracking code (e.g., EW-2026-12345)"
                value={trackingCodeInput}
                onChange={(e) => setTrackingCodeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTrackOrder(); }}
              />
              <Button onClick={handleTrackOrder} disabled={trackLoading}>
                {trackLoading ? 'Searching...' : 'Track'}
              </Button>
            </div>
            {trackedOrder && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Order {trackedOrder.trackingCode}</h4>
                  <StatusBadge status={getOrderStatusBadgeKey(trackedOrder.status)} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Customer:</span><p className="font-medium">{trackedOrder.customerName}</p></div>
                  <div><span className="text-muted-foreground">Zone:</span><p className="font-medium">{trackedOrder.zone}</p></div>
                  <div><span className="text-muted-foreground">Pickup Date:</span><p className="font-medium">{new Date(trackedOrder.pickupDate).toLocaleDateString()}</p></div>
                  <div><span className="text-muted-foreground">Est. Delivery:</span><p className="font-medium">{new Date(trackedOrder.estimatedDelivery).toLocaleDateString()}</p></div>
                  {trackedOrder.driverName && (
                    <div className="col-span-2"><span className="text-muted-foreground">Driver:</span><p className="font-medium">{trackedOrder.driverName} — {trackedOrder.driverPhone}</p></div>
                  )}
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {trackedOrder.items.map((item, idx) => (
                    <li key={idx} className="text-sm">{item.quantity}x {item.name} — KES {item.totalPrice?.toLocaleString()}</li>
                  ))}
                </ul>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-semibold">Total:</span>
                  <span className="text-lg font-bold">KES {trackedOrder.total?.toLocaleString()}</span>
                </div>
                <Button className="w-full" onClick={() => { navigate(`/admin/orders/${trackedOrder.trackingCode}`); setTrackDialogOpen(false); }}>
                  View Full Details
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Driver Dialog */}
      <Dialog open={!!assignDialogOrder} onOpenChange={() => setAssignDialogOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Driver to {assignDialogOrder?.trackingCode}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a driver..." />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id} suffix={
                    <span className={`ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                      d.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                      d.status === 'on_route' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}>{d.status}</span>
                  }>
                    {d.name} — {d.zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOrder(null)}>Cancel</Button>
            <Button
              disabled={!selectedDriverId || assignMutation.isPending}
              onClick={() => {
                if (assignDialogOrder?.id) {
                  assignMutation.mutate({ orderId: assignDialogOrder.id, driverId: selectedDriverId });
                }
              }}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Timeline Dialog */}
      <Dialog open={!!timelineOrder} onOpenChange={(open) => { if (!open) setTimelineOrder(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Timeline — {timelineOrder?.trackingCode}</DialogTitle>
            <DialogDescription>Status history for this order</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-y-auto">
            {timelineOrder?.id && <OrderTimeline orderId={timelineOrder.id} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderManagement;
