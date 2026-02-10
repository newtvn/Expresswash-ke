import { useState, useCallback } from 'react';
import { PageHeader, DataTable, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const mockInvoices = [
  { id: 'INV-2025-0045', orderId: 'EW-2025-00412', date: '2025-01-28', amount: 3500, status: 'pending', dueDate: '2025-02-11' },
  { id: 'INV-2025-0042', orderId: 'EW-2025-00408', date: '2025-01-27', amount: 2200, status: 'paid', dueDate: '2025-02-10' },
  { id: 'INV-2025-0038', orderId: 'EW-2025-00395', date: '2025-01-25', amount: 1800, status: 'paid', dueDate: '2025-02-08' },
  { id: 'INV-2025-0035', orderId: 'EW-2025-00380', date: '2025-01-22', amount: 1500, status: 'paid', dueDate: '2025-02-05' },
  { id: 'INV-2025-0030', orderId: 'EW-2025-00365', date: '2025-01-20', amount: 2400, status: 'overdue', dueDate: '2025-02-03' },
  { id: 'INV-2025-0025', orderId: 'EW-2025-00350', date: '2025-01-18', amount: 4500, status: 'paid', dueDate: '2025-02-01' },
  { id: 'INV-2025-0020', orderId: 'EW-2025-00338', date: '2025-01-15', amount: 1200, status: 'cancelled', dueDate: '2025-01-29' },
  { id: 'INV-2025-0015', orderId: 'EW-2025-00320', date: '2025-01-12', amount: 2800, status: 'paid', dueDate: '2025-01-26' },
];

const columns: Column<(typeof mockInvoices)[0]>[] = [
  { key: 'id', header: 'Invoice #', sortable: true },
  { key: 'orderId', header: 'Order #' },
  { key: 'date', header: 'Date', sortable: true },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    render: (row) => <span className="font-medium">KES {row.amount.toLocaleString()}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  { key: 'dueDate', header: 'Due Date', sortable: true },
  {
    key: 'actions',
    header: '',
    render: () => (
      <Button variant="ghost" size="sm">
        <Download className="h-4 w-4" />
      </Button>
    ),
  },
];

export const Invoices = () => {
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = mockInvoices.filter(
    (inv) => statusFilter === 'all' || inv.status === statusFilter
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="View and download your invoices" />

      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        searchable
        searchPlaceholder="Search invoices..."
        pageSize={10}
      />
    </div>
  );
};

export default Invoices;
