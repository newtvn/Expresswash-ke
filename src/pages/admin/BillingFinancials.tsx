import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, KPICard, DataTable, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, Clock, DollarSign, Download, Loader2 } from 'lucide-react';
import {
  getAllInvoices,
  getBillingFinancialSummary,
  getBillingInvoicesPage,
  type BillingInvoiceView,
} from '@/services/invoiceService';
import { toast } from 'sonner';
import type { Invoice } from '@/types';
import { InvoiceDownloadButton } from '@/components/shared';
import { BusinessSwitcher } from '@/components/admin/accounts/BusinessSwitcher';
import { useAuthStore } from '@/stores/authStore';
import { useBusinessStore } from '@/stores/businessStore';
import { exportToCSV } from '@/utils/exportUtils';

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
 * Fetches server-paginated invoices and database-computed KPIs, and provides
 * tabbed views: All Invoices, Pending, Paid, Overdue.
 */
export const BillingFinancials = () => {
  const navigate = useNavigate();
  const rawSelectedBusiness = useBusinessStore((state) => state.selectedBusiness);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin());
  const selectedBusiness = isSuperAdmin ? rawSelectedBusiness : 'expresswash';
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: BillingInvoiceView = ['all', 'pending', 'paid', 'overdue'].includes(tabParam ?? '')
    ? tabParam as BillingInvoiceView
    : 'all';
  const [activeTab, setActiveTab] = useState<BillingInvoiceView>(initialTab);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);
  useEffect(() => setPage(0), [activeTab, selectedBusiness, debouncedSearch]);

  const { data: invoicePage, isLoading: invoicesLoading, error: invoicesError } = useQuery({
    queryKey: ['admin', 'billing-financials', selectedBusiness, activeTab, page, debouncedSearch],
    queryFn: () => getBillingInvoicesPage({
      business: selectedBusiness,
      view: activeTab,
      page,
      pageSize,
      search: debouncedSearch,
    }),
    placeholderData: (previous) => previous,
  });
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['admin', 'billing-financials', 'summary', selectedBusiness],
    queryFn: () => getBillingFinancialSummary(selectedBusiness),
  });

  const rows = useMemo(() => (invoicePage?.rows ?? []).map(toRow), [invoicePage?.rows]);
  const total = invoicePage?.total ?? 0;
  const loading = invoicesLoading || summaryLoading;
  const error = invoicesError || summaryError;

  const handleExport = async () => {
    setExporting(true);
    try {
      const invoices = await getAllInvoices({ business: selectedBusiness });
      exportToCSV(invoices.map(toRow), `invoices-${selectedBusiness}`);
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : 'Failed to export invoices');
    } finally {
      setExporting(false);
    }
  };

  const kpis = useMemo(
    () => [
      {
        label: 'Total Invoiced',
        value: summary?.totalInvoiced ?? 0,
        change: 0,
        changeDirection: 'flat' as const,
        icon: DollarSign,
        format: 'currency' as const,
      },
      {
        label: 'Received',
        value: summary?.received ?? 0,
        change: 0,
        changeDirection: 'flat' as const,
        icon: CheckCircle2,
        format: 'currency' as const,
      },
      {
        label: 'Outstanding',
        value: summary?.outstanding ?? 0,
        change: 0,
        changeDirection: 'flat' as const,
        icon: Clock,
        format: 'currency' as const,
      },
      {
        label: 'Overdue',
        value: summary?.overdue ?? 0,
        change: 0,
        changeDirection: 'flat' as const,
        icon: AlertTriangle,
        format: 'currency' as const,
      },
    ],
    [summary],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & Financials" description="Manage invoices and track payments">
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center lg:gap-3">
          <BusinessSwitcher />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || (summary?.totalCount ?? 0) === 0}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export CSV
          </Button>
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
          {error instanceof Error ? error.message : 'Failed to load invoices'}. Please try refreshing the page.
        </div>
      )}

      {/* Invoice tabs */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as BillingInvoiceView)} className="min-w-0 space-y-4">
          <TabsList className="h-auto max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">All Invoices ({summary?.totalCount ?? 0})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({summary?.pendingCount ?? 0})</TabsTrigger>
            <TabsTrigger value="paid">Paid ({summary?.paidCount ?? 0})</TabsTrigger>
            <TabsTrigger value="overdue">Overdue ({summary?.overdueCount ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <DataTable
              data={rows}
              columns={invoiceColumns}
              searchPlaceholder={`Search ${activeTab === 'all' ? '' : `${activeTab} `}invoices...`}
              onRowClick={(row) => row.orderNumber !== '--' && navigate(`/admin/orders/${row.orderNumber}`)}
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
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default BillingFinancials;
