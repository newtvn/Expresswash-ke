import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader, KPICard, DataTable, StatusBadge, ExportButton } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { getInvoices } from '@/services/invoiceService';
import { toast } from 'sonner';
import type { Invoice } from '@/types';
import { InvoiceDownloadButton } from '@/components/shared';

// ── Row shape used by DataTable ──────────────────────────────────────

interface InvoiceRow {
  id: string;
  invoiceId: string;
  pdfUrl?: string;
  customer: string;
  amount: number;
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
    customer: inv.customerName,
    amount: inv.total,
    status: inv.status,
    issuedDate: new Date(inv.issuedAt).toLocaleDateString('en-KE'),
    dueDate: new Date(inv.dueAt).toLocaleDateString('en-KE'),
    paidDate: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('en-KE') : '--',
  };
}

// ── KPI computation ──────────────────────────────────────────────────

interface KPIData {
  totalInvoiced: number;
  paid: number;
  outstanding: number;
  overdue: number;
}

function computeKPIs(invoices: Invoice[]): KPIData {
  let totalInvoiced = 0;
  let paid = 0;
  let outstanding = 0;
  let overdue = 0;

  for (const inv of invoices) {
    totalInvoiced += inv.total;

    switch (inv.status) {
      case 'paid':
        paid += inv.total;
        break;
      case 'overdue':
        overdue += inv.total;
        break;
      case 'sent':
      case 'draft':
      case 'partially_paid':
        outstanding += inv.total;
        break;
      default:
        break;
    }
  }

  return { totalInvoiced, paid, outstanding, overdue };
}

// ── Columns ──────────────────────────────────────────────────────────

const invoiceColumns: Column<InvoiceRow>[] = [
  { key: 'id', header: 'Invoice #', sortable: true },
  { key: 'customer', header: 'Customer', sortable: true },
  {
    key: 'amount',
    header: 'Amount (KES)',
    sortable: true,
    render: (row) => <span className="font-medium">KES {row.amount.toLocaleString()}</span>,
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch a large page to get all invoices for KPI calculation
      const result = await getInvoices({ page: 1, limit: 500 });
      setInvoices(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load invoices';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Derived data
  const kpiData = useMemo(() => computeKPIs(invoices), [invoices]);

  const allRows = useMemo(() => invoices.map(toRow), [invoices]);
  const pendingRows = useMemo(
    () => invoices.filter((i) => ['sent', 'draft', 'partially_paid'].includes(i.status)).map(toRow),
    [invoices],
  );
  const paidRows = useMemo(
    () => invoices.filter((i) => i.status === 'paid').map(toRow),
    [invoices],
  );
  const overdueRows = useMemo(
    () => invoices.filter((i) => i.status === 'overdue').map(toRow),
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
        label: 'Paid',
        value: kpiData.paid,
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
        <ExportButton data={allRows} filename="invoices-export" />
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
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Invoices ({allRows.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pendingRows.length})</TabsTrigger>
            <TabsTrigger value="paid">Paid ({paidRows.length})</TabsTrigger>
            <TabsTrigger value="overdue">Overdue ({overdueRows.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <DataTable data={allRows} columns={invoiceColumns} searchPlaceholder="Search invoices..." />
          </TabsContent>

          <TabsContent value="pending">
            <DataTable data={pendingRows} columns={invoiceColumns} searchPlaceholder="Search pending invoices..." />
          </TabsContent>

          <TabsContent value="paid">
            <DataTable data={paidRows} columns={invoiceColumns} searchPlaceholder="Search paid invoices..." />
          </TabsContent>

          <TabsContent value="overdue">
            <DataTable data={overdueRows} columns={invoiceColumns} searchPlaceholder="Search overdue invoices..." />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default BillingFinancials;
