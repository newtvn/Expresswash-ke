import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, DataTable, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageCheck, Truck, MapPin, Clock, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getProcessingItems, getDispatchQueue, getWarehouseStats } from '@/services/warehouseService';
import { getDrivers } from '@/services/driverService';
import { supabase } from '@/lib/supabase';

interface DispatchRow {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  itemName: string;
  itemType: string;
  quantity: number;
  zone: string;
  assignedDriver: string | null;
  scheduledDelivery: string | null;
  readySince: string;
  dispatchId: string | null;
}

const DispatchQueue = () => {
  const qc = useQueryClient();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>('');

  const { data: processingItems = [], isLoading: loadingProcessing } = useQuery({
    queryKey: ['warehouse', 'processing', 'ready_for_dispatch'],
    queryFn: () => getProcessingItems('ready_for_dispatch'),
    refetchInterval: 30000,
  });

  const { data: dispatchRecords = [], isLoading: loadingDispatch } = useQuery({
    queryKey: ['warehouse', 'dispatch'],
    queryFn: getDispatchQueue,
    refetchInterval: 30000,
  });

  // Fetch zones from orders for processing items
  const orderIds = [...new Set(processingItems.map((p) => p.orderId))];
  const { data: orderZones = [] } = useQuery({
    queryKey: ['orders', 'zones', orderIds],
    queryFn: async () => {
      if (orderIds.length === 0) return [];
      const { data } = await supabase
        .from('orders')
        .select('id, zone')
        .in('id', orderIds);
      return (data ?? []) as { id: string; zone: string | null }[];
    },
    enabled: orderIds.length > 0,
  });

  const { data: stats } = useQuery({
    queryKey: ['warehouse', 'stats'],
    queryFn: getWarehouseStats,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: getDrivers,
  });

  const mergedRows: DispatchRow[] = (() => {
    const zoneMap = new Map(orderZones.map((o) => [o.id, o.zone ?? '']));
    const dispatchByOrder = new Map(dispatchRecords.map((d) => [d.orderId, d]));

    const fromProcessing: DispatchRow[] = processingItems.map((p) => {
      const d = dispatchByOrder.get(p.orderId);
      return {
        id: p.id,
        orderId: p.orderId,
        orderNumber: p.orderNumber,
        customerName: p.customerName,
        itemName: p.itemName,
        itemType: p.itemType,
        quantity: p.quantity,
        zone: d?.zone || zoneMap.get(p.orderId) || '',
        assignedDriver: d?.assignedDriver ?? null,
        scheduledDelivery: d?.scheduledDelivery ?? null,
        readySince: d?.readySince ?? p.startedAt ?? new Date().toISOString(),
        dispatchId: d?.id ?? null,
      };
    });

    const processingOrderIds = new Set(processingItems.map((p) => p.orderId));
    const orphanDispatches: DispatchRow[] = dispatchRecords
      .filter((d) => !processingOrderIds.has(d.orderId))
      .map((d) => ({
        id: d.id,
        orderId: d.orderId,
        orderNumber: d.orderNumber,
        customerName: d.customerName,
        itemName: d.items.join(', ') || 'Items',
        itemType: '',
        quantity: d.totalItems,
        zone: d.zone,
        assignedDriver: d.assignedDriver ?? null,
        scheduledDelivery: d.scheduledDelivery ?? null,
        readySince: d.readySince,
        dispatchId: d.id,
      }));

    return [...fromProcessing, ...orphanDispatches];
  })();

  const isLoading = loadingProcessing || loadingDispatch;

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
      const now = new Date().toISOString();

      if (row.dispatchId) {
        const { error } = await supabase
          .from('warehouse_dispatch')
          .update({ scheduled_delivery: now })
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
          assigned_driver: row.assignedDriver,
          scheduled_delivery: now,
        });
        if (error) throw new Error(error.message);
      }

      await supabase
        .from('orders')
        .update({ status: 10, updated_at: now })
        .eq('id', row.orderId);
    },
    onSuccess: () => {
      toast.success('Order dispatched for delivery');
      qc.invalidateQueries({ queryKey: ['warehouse'] });
    },
    onError: (e) => toast.error('Dispatch failed: ' + e.message),
  });

  const readyCount = mergedRows.filter((i) => !i.scheduledDelivery).length;
  const awaitingDriver = mergedRows.filter((i) => !i.assignedDriver && !i.scheduledDelivery).length;
  const dispatchedCount = mergedRows.filter((i) => i.scheduledDelivery).length;

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
          pageSize={10}
        />
      )}
    </div>
  );
};

export default DispatchQueue;
