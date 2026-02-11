import { PageHeader, DataTable, StatusBadge, KPICard } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Wallet, AlertCircle } from 'lucide-react';

type Payment = {
  id: string;
  date: string;
  invoiceId: string;
  method: string;
  amount: number;
  status: string;
  reference: string;
};

// TODO: Connect to real payment service
const payments: Payment[] = [];

const methodLabels: Record<string, string> = {
  mpesa: 'M-Pesa',
  card: 'Card',
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
};

const columns: Column<Payment>[] = [
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
  const completedPayments = payments.filter((p) => p.status === 'completed');
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
          change={0}
          changeDirection="flat"
          format="currency"
          icon={Wallet}
        />
        <KPICard
          label="Outstanding"
          value={0}
          change={0}
          changeDirection="flat"
          format="currency"
          icon={AlertCircle}
        />
      </div>

      <DataTable
        data={payments}
        columns={columns}
        searchable
        searchPlaceholder="Search payments..."
        pageSize={10}
      />
    </div>
  );
};

export default PaymentHistory;
