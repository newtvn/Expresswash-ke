import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, DataTable, StatusBadge, SearchInput, ExportButton } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye } from 'lucide-react';
import { toast } from 'sonner';
import { getOrders, bulkUpdateOrderStatus } from '@/services/orderService';
import { getDrivers } from '@/services/driverService';
import { assignDriverToOrder } from '@/services/orderService';
import { Order } from '@/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const STATUS_OPTIONS = [
  { value: '1', label: 'Pending' },
  { value: '2', label: 'Driver Assigned' },
  { value: '3', label: 'Quote Accepted' },
  { value: '4', label: 'Pickup Scheduled' },
  { value: '5', label: 'Picked Up' },
  { value: '6', label: 'In Washing' },
  { value: '7', label: 'Drying' },
  { value: '8', label: 'Quality Check' },
  { value: '9', label: 'Ready for Dispatch' },
  { value: '10', label: 'Dispatched' },
  { value: '11', label: 'Out for Delivery' },
  { value: '12', label: 'Delivered' },
];

export const OrderManagement = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [assignDialogOrder, setAssignDialogOrder] = useState<Order | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');

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
        toast.success(`Updated ${data.updated} orders`);
        setSelectedIds(new Set());
        setBulkStatus('');
        qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      }
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
      render: (row) => <StatusBadge status={String(row.status)} />,
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(`/portal/orders/${row.trackingCode}`)}
          >
            <Eye className="w-4 h-4" />
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
        />
      )}

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
                {drivers.filter((d) => d.isOnline || d.status === 'available').map((d) => (
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
    </div>
  );
};

export default OrderManagement;
