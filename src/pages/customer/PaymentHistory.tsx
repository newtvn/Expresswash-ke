import { useQuery } from '@tanstack/react-query';
import { PageHeader, DataTable, StatusBadge, KPICard } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, AlertCircle } from 'lucide-react';
import { getPayments } from '@/services/invoiceService';
import { QUERY_KEYS } from '@/config/queryKeys';

type PaymentTableRow = {
  id: string;
  date: string;
  invoiceId: string;
  method: string;
  amount: number;
  status: string;
  reference: string;
};

const methodLabels: Record<string, string> = {
  mpesa: 'M-Pesa',
  card: 'Card',
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
};

const columns: Column<PaymentTableRow>[] = [
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
  const { data: payments = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.payments(),
    queryFn: () => getPayments(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Transform payments to table rows
  const tableData: PaymentTableRow[] = payments.map((payment) => ({
    id: payment.id,
    date: new Date(payment.createdAt).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    invoiceId: payment.invoiceNumber,
    method: payment.method,
    amount: payment.amount,
    status: payment.status,
    reference: payment.reference || payment.mpesaReceiptNumber || 'N/A',
  }));

  const completedPayments = payments.filter((p) => p.status === 'completed');
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const totalPaidThisMonth = completedPayments
    .filter((p) => p.createdAt.startsWith(currentMonth))
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingPayments = payments.filter((p) => p.status === 'pending');
  const outstanding = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payment History" description="Track all your payments" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

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
          value={outstanding}
          change={0}
          changeDirection="flat"
          format="currency"
          icon={AlertCircle}
        />
      </div>

      <DataTable
        data={tableData}
        columns={columns}
        searchable
        searchPlaceholder="Search payments..."
        pageSize={10}
      />
    </div>
  );
};

export default PaymentHistory;
