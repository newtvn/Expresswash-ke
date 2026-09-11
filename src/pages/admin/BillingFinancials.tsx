import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, KPICard, DataTable, StatusBadge, ExportButton } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { getAllInvoices } from '@/services/invoiceService';
import { toast } from 'sonner';
import type { Invoice } from '@/types';
import { InvoiceDownloadButton } from '@/components/shared';
import { computeBillingMetrics, invoiceIsOverdue } from '@/services/billingMetrics';
import { BusinessSwitcher } from '@/components/admin/accounts/BusinessSwitcher';
import { useAuthStore } from '@/stores/authStore';
import { useBusinessStore } from '@/stores/businessStore';

// ── Row shape used by DataTable ──────────────────────────────────────

interface InvoiceRow {
  id: string;
  invoiceId: string;
  pdfUrl?: string;
  orderNumber: string;
  customer: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string;
  issuedDate: string;
  dueDate: string;
  paidDate: string;
}

function toRow(inv: Invoice): InvoiceRow {
  return {
    id: inv.invoiceNumber,
    invoiceId: inv.id,
    pdfUrl: inv.pdfUrl,
    orderNumber: inv.orderNumber || '--',
    customer: inv.customerName,
    amount: inv.total,
    paidAmount: inv.amountPaid,
    balance: inv.balance,
    status: inv.status,
    issuedDate: new Date(inv.issuedAt).toLocaleDateString('en-KE'),
    dueDate: new Date(inv.dueAt).toLocaleDateString('en-KE'),
    paidDate: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('en-KE') : '--',
  };
}

// ── Columns ──────────────────────────────────────────────────────────

const invoiceColumns: Column<InvoiceRow>[] = [
  { key: 'id', header: 'Invoice #', sortable: true },
  { key: 'orderNumber', header: 'Order #', sortable: true },
  { key: 'customer', header: 'Customer', sortable: true },
  {
    key: 'amount',
    header: 'Amount (KES)',
    sortable: true,
    render: (row) => <span className="font-medium">KES {row.amount.toLocaleString()}</span>,
  },
  {
    key: 'paidAmount',
    header: 'Paid (KES)',
    sortable: true,
    render: (row) => <span className="tabular-nums">KES {row.paidAmount.toLocaleString()}</span>,
  },
  {
    key: 'balance',
    header: 'Balance (KES)',
    sortable: true,
    render: (row) => <span className="font-medium tabular-nums">KES {row.balance.toLocaleString()}</span>,
  },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  { key: 'issuedDate', header: 'Issued', sortable: true },
  { key: 'dueDate', header: 'Due Date', sortable: true },
  { key: 'paidDate', header: 'Paid Date' },
  {
    key: 'invoiceId',
    header: 'PDF',
    render: (row) => (
      <InvoiceDownloadButton invoiceId={row.invoiceId} pdfUrl={row.pdfUrl} size="sm" variant="ghost" />
    ),
  },
];

// ── Skeleton loaders ─────────────────────────────────────────────────

function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="bg-card border-border/50">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-32" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-64" />
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/50 p-3">
          <div className="flex gap-6">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-6 p-3 border-t border-border">
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-20" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

/**
 * Admin Billing & Financials Page
 * Fetches invoices from Supabase, computes KPIs, and provides
 * tabbed views: All Invoices, Pending, Paid, Overdue.
 */
export const BillingFinancials = () => {
  const navigate = useNavigate();
  const rawSelectedBusiness = useBusinessStore((state) => state.selectedBusiness);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin());
  const selectedBusiness = isSuperAdmin ? rawSelectedBusiness : 'expresswash';
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all';
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvoices(await getAllInvoices({ business: selectedBusiness }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load invoices';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [selectedBusiness]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Derived data
  const kpiData = useMemo(() => computeBillingMetrics(invoices), [invoices]);

  const allRows = useMemo(() => invoices.map(toRow), [invoices]);
  const pendingRows = useMemo(
    () => invoices.filter((i) => ['draft', 'pending', 'sent', 'partial', 'partially_paid'].includes(i.status) && !invoiceIsOverdue(i)).map(toRow),
    [invoices],
  );
  const paidRows = useMemo(
    () => invoices.filter((i) => i.status === 'paid').map(toRow),
    [invoices],
  );
  const overdueRows = useMemo(
    () => invoices.filter((i) => invoiceIsOverdue(i)).map(toRow),
    [invoices],
  );

  const kpis = useMemo(
    () => [
      {
        label: 'Total Invoiced',
        value: kpiData.totalInvoiced,
        change: 0,
        changeDirection: 'flat' as const,
        icon: DollarSign,
        format: 'currency' as const,
      },
      {
        label: 'Received',
        value: kpiData.received,
        change: 0,
        changeDirection: 'flat' as const,
        icon: CheckCircle2,
        format: 'currency' as const,
      },
      {
        label: 'Outstanding',
        value: kpiData.outstanding,
        change: 0,
        changeDirection: 'flat' as const,
        icon: Clock,
        format: 'currency' as const,
      },
      {
        label: 'Overdue',
        value: kpiData.overdue,
        change: 0,
        changeDirection: 'flat' as const,
        icon: AlertTriangle,
        format: 'currency' as const,
      },
    ],
    [kpiData],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & Financials" description="Manage invoices and track payments">
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center lg:gap-3">
          <BusinessSwitcher />
          <ExportButton data={allRows} filename={`invoices-${selectedBusiness}`} />
        </div>
      </PageHeader>

      {/* Summary KPIs */}
      {loading ? (
        <KPISkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <KPICard key={kpi.label} {...kpi} />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}. Please try refreshing the page.
        </div>
      )}

      {/* Invoice tabs */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <Tabs defaultValue={initialTab} className="min-w-0 space-y-4">
          <TabsList className="h-auto max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">All Invoices ({allRows.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pendingRows.length})</TabsTrigger>
            <TabsTrigger value="paid">Paid ({paidRows.length})</TabsTrigger>
            <TabsTrigger value="overdue">Overdue ({overdueRows.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <DataTable data={allRows} columns={invoiceColumns} searchPlaceholder="Search invoices..." onRowClick={(row) => row.orderNumber !== '--' && navigate(`/admin/orders/${row.orderNumber}`)} />
          </TabsContent>

          <TabsContent value="pending">
            <DataTable data={pendingRows} columns={invoiceColumns} searchPlaceholder="Search pending invoices..." onRowClick={(row) => row.orderNumber !== '--' && navigate(`/admin/orders/${row.orderNumber}`)} />
          </TabsContent>

          <TabsContent value="paid">
            <DataTable data={paidRows} columns={invoiceColumns} searchPlaceholder="Search paid invoices..." onRowClick={(row) => row.orderNumber !== '--' && navigate(`/admin/orders/${row.orderNumber}`)} />
          </TabsContent>

          <TabsContent value="overdue">
            <DataTable data={overdueRows} columns={invoiceColumns} searchPlaceholder="Search overdue invoices..." onRowClick={(row) => row.orderNumber !== '--' && navigate(`/admin/orders/${row.orderNumber}`)} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default BillingFinancials;
