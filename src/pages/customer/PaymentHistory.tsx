import { PageHeader, DataTable, StatusBadge, KPICard } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, AlertCircle } from 'lucide-react';

const mockPayments = [
  { id: '1', date: '2025-01-28', invoiceId: 'INV-2025-0042', method: 'mpesa', amount: 2200, status: 'completed', reference: 'SHK7F2GHTX' },
  { id: '2', date: '2025-01-25', invoiceId: 'INV-2025-0038', method: 'mpesa', amount: 1800, status: 'completed', reference: 'SHK6D1JQRW' },
  { id: '3', date: '2025-01-22', invoiceId: 'INV-2025-0035', method: 'mpesa', amount: 1500, status: 'completed', reference: 'SHK5C9MKPV' },
  { id: '4', date: '2025-01-20', invoiceId: 'INV-2025-0030', method: 'card', amount: 2400, status: 'completed', reference: 'TXN-4829371' },
  { id: '5', date: '2025-01-18', invoiceId: 'INV-2025-0025', method: 'mpesa', amount: 4500, status: 'completed', reference: 'SHK4B8NLOU' },
  { id: '6', date: '2025-01-12', invoiceId: 'INV-2025-0020', method: 'mpesa', amount: 2800, status: 'completed', reference: 'SHK3A7WMST' },
  { id: '7', date: '2025-01-10', invoiceId: 'INV-2025-0015', method: 'cash', amount: 3100, status: 'completed', reference: 'CASH-001' },
  { id: '8', date: '2025-01-08', invoiceId: 'INV-2025-0010', method: 'mpesa', amount: 2700, status: 'completed', reference: 'SHK2Z6XKRQ' },
  { id: '9', date: '2025-01-05', invoiceId: 'INV-2025-0008', method: 'mpesa', amount: 1900, status: 'failed', reference: 'SHK1Y5WJPP' },
  { id: '10', date: '2025-01-03', invoiceId: 'INV-2025-0005', method: 'mpesa', amount: 3200, status: 'completed', reference: 'SHK0X4VINN' },
];

const methodLabels: Record<string, string> = {
  mpesa: 'M-Pesa',
  card: 'Card',
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
};

const columns: Column<(typeof mockPayments)[0]>[] = [
  { key: 'date', header: 'Date', sortable: true },
  { key: 'invoiceId', header: 'Invoice #', sortable: true },
  {
    key: 'method',
    header: 'Method',
    render: (row) => (
      <Badge variant="outline" className="font-medium">
        {methodLabels[row.method] ?? row.method}
      </Badge>
    ),
  },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    render: (row) => <span className="font-medium">KES {row.amount.toLocaleString()}</span>,
  },
  { key: 'reference', header: 'Reference' },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export const PaymentHistory = () => {
  const completedPayments = mockPayments.filter((p) => p.status === 'completed');
  const totalPaidThisMonth = completedPayments
    .filter((p) => p.date.startsWith('2025-01'))
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Payment History" description="Track all your payments" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard
          label="Total Paid This Month"
          value={totalPaidThisMonth}
          change={12}
          changeDirection="up"
          format="currency"
          icon={Wallet}
        />
        <KPICard
          label="Outstanding"
          value={3500}
          change={5}
          changeDirection="down"
          format="currency"
          icon={AlertCircle}
        />
      </div>

      <DataTable
        data={mockPayments}
        columns={columns}
        searchable
        searchPlaceholder="Search payments..."
        pageSize={10}
      />
    </div>
  );
};

export default PaymentHistory;
