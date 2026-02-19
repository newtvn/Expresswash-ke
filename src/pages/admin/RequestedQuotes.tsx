import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, DataTable, StatusBadge, SearchInput } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, UserCheck, Clock, Package, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { getOrders, assignDriverToOrder } from '@/services/orderService';
import { getDrivers } from '@/services/driverService';
import { ORDER_STATUS } from '@/constants/orderStatus';
import { Order } from '@/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

export const RequestedQuotes = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [assignDialogOrder, setAssignDialogOrder] = useState<Order | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Fetch only PENDING orders (status = 1) — these are incoming quote requests
  const { data: result, isLoading } = useQuery({
    queryKey: ['admin', 'quotes', search],
    queryFn: () =>
      getOrders({
        status: ORDER_STATUS.PENDING,
        search: search || undefined,
        page: 1,
        limit: 50,
      }),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers', 'list'],
    queryFn: getDrivers,
  });

  const assignMutation = useMutation({
    mutationFn: ({ orderId, driverId }: { orderId: string; driverId: string }) => {
      const driver = drivers.find((d) => d.id === driverId);
      if (!driver) throw new Error('Driver not found');
      return assignDriverToOrder(orderId, driverId, driver.name, driver.phone);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Driver assigned — quote confirmed!');
        setAssignDialogOrder(null);
        setSelectedDriverId('');
        qc.invalidateQueries({ queryKey: ['admin', 'quotes'] });
        qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      } else {
        toast.error(data.error ?? 'Failed to assign driver');
      }
    },
  });

  const allQuotes = result?.data ?? [];
  const quotes = zoneFilter === 'all'
    ? allQuotes
    : allQuotes.filter((q) => q.zone?.toLowerCase().includes(zoneFilter.toLowerCase()));

  // Stats
  const totalValue = quotes.reduce((sum, q) => sum + (q.total ?? 0), 0);
  const zones = [...new Set(allQuotes.map((q) => q.zone).filter(Boolean))];
  const todayCount = quotes.filter((q) => {
    if (!q.createdAt) return false;
    return new Date(q.createdAt).toDateString() === new Date().toDateString();
  }).length;

  const columns: Column<Order>[] = [
    { key: 'trackingCode', header: 'Quote ID', sortable: true },
    { key: 'customerName', header: 'Customer', sortable: true },
    {
      key: 'items',
      header: 'Items Requested',
      render: (row) => (
        <div className="space-y-0.5">
          {row.items.map((item, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium">{item.quantity}x</span>{' '}
              <span>{item.name}</span>
              {item.lengthInches && item.widthInches && (
                <span className="text-muted-foreground ml-1">
                  ({item.lengthInches}" × {item.widthInches}")
                </span>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'zone',
      header: 'Zone',
      render: (row) => <Badge variant="outline">{row.zone}</Badge>,
    },
    {
      key: 'total',
      header: 'Estimated Total',
      render: (row) => (
        <span className="font-semibold">KES {(row.total ?? 0).toLocaleString()}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Requested',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-KE', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          }) : '—'}
        </span>
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
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => setAssignDialogOrder(row)}
          >
            <UserCheck className="w-3 h-3" />
            Confirm & Assign
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requested Quotes"
        description="Monitor incoming customer requests and assign drivers to confirm"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allQuotes.length}</p>
                <p className="text-xs text-muted-foreground">Pending Quotes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">KES {totalValue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayCount}</p>
                <p className="text-xs text-muted-foreground">Today's Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <UserCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{drivers.filter((d) => d.isOnline || d.status === 'available').length}</p>
                <p className="text-xs text-muted-foreground">Drivers Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          onSearch={useCallback((v: string) => setSearch(v), [])}
          placeholder="Search by customer or tracking code..."
          className="w-72"
        />
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Zone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {zones.map((z) => (
              <SelectItem key={z} value={z!}>{z}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded" />)}
        </div>
      ) : quotes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No pending quotes</h3>
            <p className="text-muted-foreground text-sm">
              All customer requests have been processed. New requests will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          data={quotes}
          columns={columns}
          searchable={false}
          pageSize={20}
        />
      )}

      {/* Assign Driver Dialog */}
      <Dialog open={!!assignDialogOrder} onOpenChange={() => setAssignDialogOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Quote & Assign Driver</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {assignDialogOrder && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{assignDialogOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zone</span>
                  <span className="font-medium">{assignDialogOrder.zone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items</span>
                  <span className="font-medium">{assignDialogOrder.items.length} item(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold">KES {(assignDialogOrder.total ?? 0).toLocaleString()}</span>
                </div>
              </div>
            )}
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
              {assignMutation.isPending ? 'Assigning...' : 'Confirm & Assign Driver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestedQuotes;
