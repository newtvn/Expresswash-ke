import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, DataTable, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageCheck, Truck, MapPin, Clock, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  dispatchWarehouseOrder,
  getDispatchQueuePage,
  getDispatchQueueStats,
  getWarehouseStats,
  type WarehouseDispatchPageRow,
} from '@/services/warehouseService';
import { getDrivers } from '@/services/driverService';
import { supabase } from '@/lib/supabase';

type DispatchRow = WarehouseDispatchPageRow & Record<string, unknown>;

const DispatchQueue = () => {
  const qc = useQueryClient();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 20;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);
  useEffect(() => setPage(0), [debouncedSearch]);

  const { data: dispatchPage, isLoading } = useQuery({
    queryKey: ['warehouse', 'dispatch', page, debouncedSearch],
    queryFn: () => getDispatchQueuePage({ page, pageSize, search: debouncedSearch }),
    refetchInterval: 30000,
    placeholderData: (previous) => previous,
  });
  const mergedRows = (dispatchPage?.rows ?? []) as DispatchRow[];
  const dispatchTotal = dispatchPage?.total ?? 0;

  const { data: stats } = useQuery({
    queryKey: ['warehouse', 'stats'],
    queryFn: getWarehouseStats,
  });
  const { data: dispatchStats } = useQuery({
    queryKey: ['warehouse', 'dispatch', 'stats'],
    queryFn: getDispatchQueueStats,
    refetchInterval: 30000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: getDrivers,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ row, driverId }: { row: DispatchRow; driverId: string }) => {
      const driver = drivers.find((d) => d.id === driverId);
      if (!driver) throw new Error('Driver not found');

      if (row.dispatchId) {
        const { error } = await supabase
          .from('warehouse_dispatch')
          .update({ assigned_driver: driver.name })
          .eq('id', row.dispatchId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('warehouse_dispatch').insert({
          order_id: row.orderId,
          order_number: row.orderNumber,
          customer_name: row.customerName,
          zone: row.zone || 'Unassigned',
          items: [`${row.itemName} x${row.quantity}`],
          total_items: row.quantity,
          ready_since: row.readySince,
          assigned_driver: driver.name,
        });
        if (error) throw new Error(error.message);
      }

      // Update orders table with driver info — triggers driver notification
      await supabase
        .from('orders')
        .update({
          driver_id: driver.id,
          driver_name: driver.name,
          driver_phone: driver.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.orderId);
    },
    onSuccess: () => {
      toast.success('Driver assigned and notified');
      setAssigningId(null);
      setSelectedDriver('');
      qc.invalidateQueries({ queryKey: ['warehouse', 'dispatch'] });
    },
    onError: (e) => toast.error('Failed to assign driver: ' + e.message),
  });

  const dispatchMutation = useMutation({
    mutationFn: async ({ row }: { row: DispatchRow }) => {
      const result = await dispatchWarehouseOrder(row.orderId);
      if (!result.success) throw new Error(result.error ?? 'Order was not dispatched');
    },
    onSuccess: () => {
      toast.success('Order dispatched for delivery');
      qc.invalidateQueries({ queryKey: ['warehouse'] });
    },
    onError: (e) => toast.error('Dispatch failed: ' + e.message),
  });

  const readyCount = dispatchStats?.ready ?? 0;
  const awaitingDriver = dispatchStats?.awaitingDriver ?? 0;
  const dispatchedCount = dispatchStats?.dispatched ?? 0;

  const statCards = [
    { label: 'Ready to Dispatch', value: readyCount, icon: PackageCheck, color: 'bg-primary/10 text-primary' },
    { label: 'Awaiting Driver', value: awaitingDriver, icon: Clock, color: 'bg-amber-100 text-amber-600' },
    { label: 'Dispatched', value: dispatchedCount, icon: Truck, color: 'bg-blue-100 text-blue-600' },
    { label: 'Total in Pipeline', value: stats?.totalItems ?? mergedRows.length, icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
  ];

  const renderDriverAssignUI = (row: DispatchRow) => (
    <div className="flex items-center gap-2">
      <Select value={selectedDriver} onValueChange={setSelectedDriver}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Select driver" />
        </SelectTrigger>
        <SelectContent>
          {drivers.filter((d) => d.isActive).map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={!selectedDriver || assignMutation.isPending}
        onClick={() => assignMutation.mutate({ row, driverId: selectedDriver })}
      >
        {assignMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => { setAssigningId(null); setSelectedDriver(''); }}>
        Cancel
      </Button>
    </div>
  );

  const dispatchColumns: Column<DispatchRow>[] = [
    { key: 'orderNumber', header: 'Order', sortable: true },
    { key: 'customerName', header: 'Customer', sortable: true },
    {
      key: 'itemName',
      header: 'Items',
      render: (row) => (
        <span className="text-sm">{row.itemName}{row.quantity > 1 ? ` x${row.quantity}` : ''}</span>
      ),
    },
    {
      key: 'zone',
      header: 'Zone',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3 text-muted-foreground" />
          <span>{row.zone || 'Unassigned'}</span>
        </div>
      ),
    },
    {
      key: 'assignedDriver',
      header: 'Driver',
      render: (row) => (
        <span className={!row.assignedDriver ? 'text-muted-foreground' : 'font-medium'}>
          {row.assignedDriver || 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'readySince',
      header: 'Ready Since',
      sortable: true,
      render: (row) => (
        <span className="text-sm">{new Date(row.readySince).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => {
        if (row.scheduledDelivery) {
          return <StatusBadge status="dispatched" />;
        }

        // Currently editing this row's driver
        if (assigningId === row.id) {
          return renderDriverAssignUI(row);
        }

        // No driver assigned yet
        if (!row.assignedDriver) {
          return (
            <Button variant="outline" size="sm" onClick={() => setAssigningId(row.id)}>
              Assign Driver
            </Button>
          );
        }

        // Has driver — show Dispatch + Reassign
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => dispatchMutation.mutate({ row })}
              disabled={dispatchMutation.isPending}
            >
              {dispatchMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Truck className="w-4 h-4 mr-1" />
              )}
              Dispatch
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setAssigningId(row.id); setSelectedDriver(''); }}
              title="Reassign driver"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dispatch Queue" description="Manage items ready for delivery" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-card border-border/50">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <DataTable
          data={mergedRows}
          columns={dispatchColumns}
          searchable
          searchPlaceholder="Search dispatch items..."
          pageSize={pageSize}
          serverPagination={{
            page,
            pageSize,
            total: dispatchTotal,
            totalPages: Math.max(1, Math.ceil(dispatchTotal / pageSize)),
            onPageChange: setPage,
            onSearchChange: setSearch,
          }}
        />
      )}
    </div>
  );
};

export default DispatchQueue;
