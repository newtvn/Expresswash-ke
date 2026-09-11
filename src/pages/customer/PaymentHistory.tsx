import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, DataTable, StatusBadge, KPICard } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, AlertCircle } from 'lucide-react';
import { getCustomerBillingSummary, getPaymentsPage } from '@/services/invoiceService';
import { queryKeys } from '@/config/queryKeys';
import { useAuth } from '@/hooks/useAuth';

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
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 10;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);
  useEffect(() => setPage(0), [debouncedSearch]);

  const { data: paymentPage, isLoading: paymentsLoading } = useQuery({
    queryKey: [...queryKeys.payments.list(), 'customer', user?.id, page, debouncedSearch],
    queryFn: () => getPaymentsPage({
      page,
      pageSize,
      customerId: user!.id,
      search: debouncedSearch,
    }),
    enabled: !!user?.id,
    placeholderData: (previous) => previous,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: [...queryKeys.payments.all, 'customer-summary', user?.id],
    queryFn: () => getCustomerBillingSummary(user!.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const payments = paymentPage?.rows ?? [];
  const total = paymentPage?.total ?? 0;
  const isLoading = paymentsLoading || summaryLoading;

  // Transform payments to table rows
  const tableData: PaymentTableRow[] = payments.map((payment) => ({
    id: payment.id,
    date: new Date(payment.createdAt).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    invoiceId: payment.invoiceNumber || payment.orderId || '--',
    method: payment.method,
    amount: payment.amount,
    status: payment.status,
    reference: payment.reference || payment.mpesaReceiptNumber || payment.referenceNumber || 'N/A',
  }));

  const totalPaidThisMonth = summary?.paidThisMonth ?? 0;
  const outstanding = summary?.outstanding ?? 0;

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
        pageSize={pageSize}
        serverPagination={{
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          onPageChange: setPage,
          onSearchChange: setSearch,
        }}
      />
    </div>
  );
};

export default PaymentHistory;
