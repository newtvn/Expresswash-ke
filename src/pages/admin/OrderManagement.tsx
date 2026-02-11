import { useState, useEffect, useCallback } from 'react';
import { PageHeader, DataTable, StatusBadge, SearchInput, ExportButton, DateRangePicker } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getOrders, updateOrderStatus } from '@/services/orderService';
import type { Order } from '@/types';

/** Numeric status codes mapped to human-readable string labels */
const STATUS_MAP: Record<number, string> = {
  0: 'cancelled',
  1: 'pending',
  2: 'driver_assigned',
  3: 'picked_up',
  4: 'at_warehouse',
  5: 'processing',
  6: 'quality_check',
  7: 'ready_for_delivery',
  8: 'out_for_delivery',
  9: 'delivered',
};

/** Reverse lookup: string label back to numeric status */
const STATUS_REVERSE: Record<string, number> = Object.fromEntries(
  Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]),
);

/** Format a status number into the string label for StatusBadge */
function statusLabel(status: number): string {
  return STATUS_MAP[status] ?? 'unknown';
}

/** Format Order items array into a short summary string */
function formatItems(items: Order['items']): string {
  if (!items || items.length === 0) return '--';
  return items.map((i) => `${i.quantity} ${i.name}`).join(', ');
}

/** Row shape that DataTable receives (flat record with string keys) */
interface OrderRow extends Record<string, unknown> {
  trackingCode: string;
  customerName: string;
  items: string;
  statusNum: number;
  status: string;
  total: number;
  zone: string;
  pickupDate: string;
  estimatedDelivery: string;
  driverName: string;
}

function toRow(order: Order): OrderRow {
  return {
    trackingCode: order.trackingCode,
    customerName: order.customerName,
    items: formatItems(order.items),
    statusNum: order.status,
    status: statusLabel(order.status),
    total: order.total ?? 0,
    zone: order.zone ?? '--',
    pickupDate: order.pickupDate ?? '--',
    estimatedDelivery: order.estimatedDelivery ?? '--',
    driverName: order.driverName ?? '--',
  };
}

/** Loading skeleton that mimics the table layout */
function TableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/50 p-3 flex gap-4">
          {[40, 120, 120, 160, 100, 100, 100, 100].map((w, i) => (
            <Skeleton key={i} className="h-4" style={{ width: w }} />
          ))}
        </div>
        {/* Row skeletons */}
        {Array.from({ length: 8 }).map((_, rowIdx) => (
          <div key={rowIdx} className="p-3 flex gap-4 border-t border-border">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-[110px]" />
            <Skeleton className="h-4 w-[110px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-5 w-[90px] rounded-full" />
            <Skeleton className="h-4 w-[80px]" />
            <Skeleton className="h-4 w-[90px]" />
            <Skeleton className="h-4 w-[100px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Admin Order Management Page
 * Fetches real data from Supabase via orderService.
 * SearchInput + status filter + DateRangePicker.
 * Bulk status update. ExportButton for CSV. Driver column.
 */
export const OrderManagement = () => {
  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');

  // Data state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalOrders, setTotalOrders] = useState(0);
  const [page, setPage] = useState(1);
  const [updatingBulk, setUpdatingBulk] = useState(false);
  const limit = 50;

  /** Fetch orders from Supabase */
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusNum =
        statusFilter !== 'all' ? STATUS_REVERSE[statusFilter] : undefined;

      const result = await getOrders({
        status: statusNum,
        search: search || undefined,
        page,
        limit,
      });

      setOrders(result.data);
      setTotalOrders(result.total);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  // Fetch when filters / page change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  // Convert orders to flat rows for DataTable
  const rows: OrderRow[] = orders.map(toRow);

  // Client-side date range filtering (pickup date)
  const filteredRows = rows.filter((row) => {
    if (dateRange.start && row.pickupDate < dateRange.start) return false;
    if (dateRange.end && row.pickupDate > dateRange.end) return false;
    return true;
  });

  const toggleSelect = (trackingCode: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackingCode)) next.delete(trackingCode);
      else next.add(trackingCode);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((o) => o.trackingCode)));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0 || !bulkStatus) return;
    const newStatusNum = STATUS_REVERSE[bulkStatus];
    if (newStatusNum === undefined) return;

    setUpdatingBulk(true);
    let successCount = 0;
    let failCount = 0;

    const promises = Array.from(selectedIds).map(async (trackingCode) => {
      try {
        const result = await updateOrderStatus(trackingCode, newStatusNum);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    });

    await Promise.all(promises);

    if (successCount > 0) {
      toast.success(
        `Updated ${successCount} order${successCount > 1 ? 's' : ''} to ${bulkStatus.replace(/_/g, ' ')}`,
      );
    }
    if (failCount > 0) {
      toast.error(`Failed to update ${failCount} order${failCount > 1 ? 's' : ''}`);
    }

    setSelectedIds(new Set());
    setBulkStatus('');
    setUpdatingBulk(false);
    fetchOrders();
  };

  const orderColumns: Column<OrderRow>[] = [
    {
      key: 'trackingCode',
      header: '',
      className: 'w-10',
      render: (row) => (
        <Checkbox
          checked={selectedIds.has(row.trackingCode)}
          onCheckedChange={() => toggleSelect(row.trackingCode)}
        />
      ),
    },
    { key: 'trackingCode', header: 'Order ID', sortable: true },
    { key: 'customerName', header: 'Customer', sortable: true },
    { key: 'items', header: 'Items' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'total',
      header: 'Total (KES)',
      sortable: true,
      render: (row) => (
        <span className="font-medium">
          {row.total > 0 ? `KES ${row.total.toLocaleString()}` : '--'}
        </span>
      ),
    },
    { key: 'zone', header: 'Zone', sortable: true },
    { key: 'pickupDate', header: 'Pickup Date', sortable: true },
    { key: 'driverName', header: 'Driver' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Order Management" description="View and manage all customer orders">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </div>
      </PageHeader>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          onSearch={handleSearch}
          placeholder="Search by tracking code, customer, zone..."
          className="w-72"
        />

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="driver_assigned">Driver Assigned</SelectItem>
            <SelectItem value="picked_up">Picked Up</SelectItem>
            <SelectItem value="at_warehouse">At Warehouse</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="quality_check">Quality Check</SelectItem>
            <SelectItem value="ready_for_delivery">Ready for Delivery</SelectItem>
            <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>

        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onRangeChange={(start, end) => setDateRange({ start, end })}
        />

        <ExportButton data={filteredRows} filename="orders-export" />

        {!loading && (
          <span className="text-sm text-muted-foreground ml-auto">
            {totalOrders} total order{totalOrders !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          <Checkbox
            checked={selectedIds.size === filteredRows.length}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Change status to..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="driver_assigned">Driver Assigned</SelectItem>
              <SelectItem value="picked_up">Picked Up</SelectItem>
              <SelectItem value="at_warehouse">At Warehouse</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="quality_check">Quality Check</SelectItem>
              <SelectItem value="ready_for_delivery">Ready for Delivery</SelectItem>
              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleBulkUpdate}
            disabled={!bulkStatus || updatingBulk}
          >
            {updatingBulk ? 'Updating...' : 'Update'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <Button variant="outline" size="sm" onClick={fetchOrders} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Orders Table */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          data={filteredRows}
          columns={orderColumns}
          searchable={false}
          onRowClick={(row) => alert(`View order: ${row.trackingCode}`)}
          emptyMessage="No orders found. Adjust your filters or create a new order."
        />
      )}
    </div>
  );
};

export default OrderManagement;
