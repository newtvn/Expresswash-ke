import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, DataTable, StatusBadge, SearchInput, ExportButton } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const mockOrders = [
  { id: 'EW-2025-00412', date: '2025-01-28', items: '2 Carpets, 1 Rug', status: 'processing', total: 3500 },
  { id: 'EW-2025-00408', date: '2025-01-27', items: '1 Sofa (3-Seater)', status: 'picked_up', total: 2200 },
  { id: 'EW-2025-00395', date: '2025-01-25', items: '3 Curtain Pairs', status: 'ready', total: 1800 },
  { id: 'EW-2025-00380', date: '2025-01-22', items: '1 Mattress, 2 Pillows', status: 'delivered', total: 1500 },
  { id: 'EW-2025-00365', date: '2025-01-20', items: '4 Dining Chairs', status: 'delivered', total: 2400 },
  { id: 'EW-2025-00350', date: '2025-01-18', items: '1 Persian Rug', status: 'delivered', total: 4500 },
  { id: 'EW-2025-00338', date: '2025-01-15', items: '2 Curtain Pairs', status: 'cancelled', total: 1200 },
  { id: 'EW-2025-00320', date: '2025-01-12', items: '1 Carpet (Large)', status: 'delivered', total: 2800 },
  { id: 'EW-2025-00305', date: '2025-01-10', items: '1 Sofa, 2 Cushions', status: 'delivered', total: 3100 },
  { id: 'EW-2025-00290', date: '2025-01-08', items: '3 Rugs', status: 'delivered', total: 2700 },
];

const columns: Column<(typeof mockOrders)[0]>[] = [
  { key: 'id', header: 'Order #', sortable: true },
  { key: 'date', header: 'Date', sortable: true },
  { key: 'items', header: 'Items' },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'total',
    header: 'Total',
    sortable: true,
    render: (row) => <span className="font-medium">KES {row.total.toLocaleString()}</span>,
  },
];

export const OrderHistory = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const filtered = mockOrders.filter((order) => {
    const matchesSearch =
      !search ||
      order.id.toLowerCase().includes(search.toLowerCase()) ||
      order.items.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Order History" description="View and track all your past orders">
        <ExportButton data={filtered} filename="order-history" />
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput
          onSearch={handleSearch}
          placeholder="Search orders..."
          className="sm:w-80"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="picked_up">Picked Up</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        searchable={false}
        pageSize={10}
        onRowClick={(row) => navigate(`/portal/orders/${row.id}`)}
      />
    </div>
  );
};

export default OrderHistory;
