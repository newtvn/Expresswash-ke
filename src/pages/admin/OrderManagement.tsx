import { useState, useCallback } from 'react';
import { PageHeader, DataTable, StatusBadge, SearchInput, ExportButton, DateRangePicker } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

const mockOrders = [
  { id: 'EW-2024-01284', customer: 'Grace Wanjiku', items: '2 Carpets, 1 Sofa', status: 'in_washing', total: 2300, date: '2024-12-15', driver: 'Joseph Mwangi' },
  { id: 'EW-2024-01283', customer: 'Peter Kamau', items: '3 Curtain Pairs', status: 'picked_up', total: 1200, date: '2024-12-15', driver: 'Brian Ochieng' },
  { id: 'EW-2024-01282', customer: 'Mary Njeri', items: '1 Mattress', status: 'quality_check', total: 800, date: '2024-12-14', driver: 'Daniel Kiprop' },
  { id: 'EW-2024-01281', customer: 'John Odera', items: '1 Rug, 2 Chairs', status: 'dispatched', total: 1050, date: '2024-12-14', driver: 'Samuel Otieno' },
  { id: 'EW-2024-01280', customer: 'Sarah Wambui', items: '1 Sofa (3-Seater)', status: 'delivered', total: 1200, date: '2024-12-14', driver: 'Joseph Mwangi' },
  { id: 'EW-2024-01279', customer: 'David Maina', items: '2 Carpets', status: 'ready_for_dispatch', total: 1600, date: '2024-12-13', driver: '--' },
  { id: 'EW-2024-01278', customer: 'Faith Akinyi', items: '4 Chairs', status: 'drying', total: 1200, date: '2024-12-13', driver: '--' },
  { id: 'EW-2024-01277', customer: 'James Mwangi', items: '1 Carpet (Large)', status: 'pending_quote', total: 0, date: '2024-12-13', driver: '--' },
  { id: 'EW-2024-01276', customer: 'Ann Chebet', items: '2 Mattresses', status: 'out_for_delivery', total: 1600, date: '2024-12-12', driver: 'Patrick Njoroge' },
  { id: 'EW-2024-01275', customer: 'Brian Otieno', items: '1 Sofa, 1 Rug', status: 'delivered', total: 1250, date: '2024-12-12', driver: 'George Mutua' },
  { id: 'EW-2024-01274', customer: 'Lucy Wairimu', items: '3 Carpets', status: 'quote_sent', total: 2400, date: '2024-12-11', driver: '--' },
  { id: 'EW-2024-01273', customer: 'Tom Nyaga', items: '1 Curtain, 1 Chair', status: 'quote_accepted', total: 500, date: '2024-12-11', driver: '--' },
];

/**
 * Admin Order Management Page
 * SearchInput + status filter + DateRangePicker.
 * Bulk status update. ExportButton for CSV. Driver column.
 */
export const OrderManagement = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '2024-12-01', end: '2024-12-31' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const filteredOrders = mockOrders.filter((order) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (search) {
      const lower = search.toLowerCase();
      if (
        !order.id.toLowerCase().includes(lower) &&
        !order.customer.toLowerCase().includes(lower) &&
        !order.items.toLowerCase().includes(lower)
      )
        return false;
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const handleBulkUpdate = () => {
    if (selectedIds.size === 0 || !bulkStatus) return;
    toast.success(`Updated ${selectedIds.size} orders to ${bulkStatus.replace(/_/g, ' ')}`);
    setSelectedIds(new Set());
    setBulkStatus('');
  };

  const orderColumns: Column<(typeof mockOrders)[0]>[] = [
    {
      key: 'id',
      header: '',
      className: 'w-10',
      render: (row) => (
        <Checkbox
          checked={selectedIds.has(row.id)}
          onCheckedChange={() => toggleSelect(row.id)}
        />
      ),
    },
    { key: 'id', header: 'Order ID', sortable: true },
    { key: 'customer', header: 'Customer', sortable: true },
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
    { key: 'date', header: 'Date', sortable: true },
    { key: 'driver', header: 'Driver' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Order Management" description="View and manage all customer orders">
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Order
        </Button>
      </PageHeader>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          onSearch={handleSearch}
          placeholder="Search orders..."
          className="w-64"
        />

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_quote">Pending Quote</SelectItem>
            <SelectItem value="quote_sent">Quote Sent</SelectItem>
            <SelectItem value="quote_accepted">Quote Accepted</SelectItem>
            <SelectItem value="picked_up">Picked Up</SelectItem>
            <SelectItem value="in_washing">In Washing</SelectItem>
            <SelectItem value="drying">Drying</SelectItem>
            <SelectItem value="quality_check">Quality Check</SelectItem>
            <SelectItem value="ready_for_dispatch">Ready for Dispatch</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>

        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onRangeChange={(start, end) => setDateRange({ start, end })}
        />

        <ExportButton data={filteredOrders} filename="orders-export" />
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Change status to..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_washing">In Washing</SelectItem>
              <SelectItem value="drying">Drying</SelectItem>
              <SelectItem value="quality_check">Quality Check</SelectItem>
              <SelectItem value="ready_for_dispatch">Ready for Dispatch</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleBulkUpdate} disabled={!bulkStatus}>
            Update
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

      {/* Orders Table */}
      <DataTable
        data={filteredOrders}
        columns={orderColumns}
        searchable={false}
        onRowClick={(row) => alert(`View order: ${row.id}`)}
      />
    </div>
  );
};

export default OrderManagement;
