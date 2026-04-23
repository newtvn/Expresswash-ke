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
import { Package, History } from 'lucide-react';
import { toast } from 'sonner';
import { getOrders, bulkUpdateOrderStatus, trackOrder } from '@/services/orderService';
import { getDrivers } from '@/services/driverService';
import { assignDriverToOrder } from '@/services/orderService';
import { Order } from '@/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { OrderTimeline } from '@/components/admin/OrderTimeline';
import { getOrderStatusBadgeKey } from '@/constants/orderStatus';

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

    if (!code) {
      toast.error('Please enter a tracking code');
      return;
    }

    // Validate tracking code format (EW-YYYY-NNNNN)
    const trackingCodeRegex = /^EW-\d{4}-\d{5}$/i;
    if (!trackingCodeRegex.test(code)) {
      toast.error('Invalid tracking code format', {
        description: 'Tracking code should be in format: EW-YYYY-NNNNN (e.g., EW-2026-12345)',
      });
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
    } catch (error) {
      toast.error('Failed to track order');
    } finally {
      setTrackLoading(false);
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
          {!row.driverName && row.status === 1 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setAssignDialogOrder(row)}
            >
              Assign Driver
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Order Management" description="View and manage all customer orders" />

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
            onClick={() =>
              bulkMutation.mutate({
                ids: Array.from(selectedIds),
                status: Number(bulkStatus),
              })
            }
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

      {/* Track Order Dialog */}
      <Dialog open={trackDialogOpen} onOpenChange={(open) => {
        setTrackDialogOpen(open);
        if (!open) {
          setTrackingCodeInput('');
          setTrackedOrder(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Track Order</DialogTitle>
            <DialogDescription>
              Enter a tracking code to view order details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter tracking code (e.g., EW-2026-12345)"
                value={trackingCodeInput}
                onChange={(e) => setTrackingCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTrackOrder();
                }}
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
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <p className="font-medium">{trackedOrder.customerName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Zone:</span>
                    <p className="font-medium">{trackedOrder.zone}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pickup Date:</span>
                    <p className="font-medium">{new Date(trackedOrder.pickupDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Estimated Delivery:</span>
                    <p className="font-medium">{new Date(trackedOrder.estimatedDelivery).toLocaleDateString()}</p>
                  </div>
                  {trackedOrder.driverName && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Driver:</span>
                      <p className="font-medium">{trackedOrder.driverName} - {trackedOrder.driverPhone}</p>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">Items:</span>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {trackedOrder.items.map((item, idx) => (
                      <li key={idx} className="text-sm">
                        {item.quantity}x {item.name} - KES {item.totalPrice?.toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-semibold">Total:</span>
                  <span className="text-lg font-bold">KES {trackedOrder.total?.toLocaleString()}</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    navigate(`/admin/orders/${trackedOrder.trackingCode}`);
                    setTrackDialogOpen(false);
                  }}
                >
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
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} — {d.zone} ({d.status})
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
                  assignMutation.mutate({
                    orderId: assignDialogOrder.id,
                    driverId: selectedDriverId,
                  });
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
            <DialogDescription>
              Status history for this order
            </DialogDescription>
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
