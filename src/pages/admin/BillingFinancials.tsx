import { PageHeader, KPICard, DataTable, StatusBadge, ExportButton } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

const kpis = [
  { label: 'Total Invoiced', value: 9836, change: 15.2, changeDirection: 'up' as const, icon: DollarSign, format: 'currency' as const },
  { label: 'Paid', value: 5104, change: 10.5, changeDirection: 'up' as const, icon: CheckCircle2, format: 'currency' as const },
  { label: 'Outstanding', value: 3514, change: 3.8, changeDirection: 'up' as const, icon: Clock, format: 'currency' as const },
  { label: 'Overdue', value: 1218, change: -2.1, changeDirection: 'down' as const, icon: AlertTriangle, format: 'currency' as const },
];

const mockInvoices = [
  { id: 'INV-2024-0501', customer: 'Grace Wanjiku', amount: 2668, status: 'sent', issuedDate: '2024-12-15', dueDate: '2024-12-22', paidDate: '--' },
  { id: 'INV-2024-0500', customer: 'Peter Kamau', amount: 1392, status: 'paid', issuedDate: '2024-12-15', dueDate: '2024-12-22', paidDate: '2024-12-16' },
  { id: 'INV-2024-0499', customer: 'Mary Njeri', amount: 928, status: 'paid', issuedDate: '2024-12-14', dueDate: '2024-12-21', paidDate: '2024-12-15' },
  { id: 'INV-2024-0498', customer: 'John Odera', amount: 1218, status: 'overdue', issuedDate: '2024-12-10', dueDate: '2024-12-17', paidDate: '--' },
  { id: 'INV-2024-0497', customer: 'Sarah Wambui', amount: 1392, status: 'paid', issuedDate: '2024-12-14', dueDate: '2024-12-21', paidDate: '2024-12-15' },
  { id: 'INV-2024-0496', customer: 'David Maina', amount: 1856, status: 'partially_paid', issuedDate: '2024-12-13', dueDate: '2024-12-20', paidDate: '--' },
  { id: 'INV-2024-0495', customer: 'Faith Akinyi', amount: 1392, status: 'draft', issuedDate: '2024-12-13', dueDate: '2024-12-20', paidDate: '--' },
  { id: 'INV-2024-0494', customer: 'James Mwangi', amount: 990, status: 'sent', issuedDate: '2024-12-13', dueDate: '2024-12-20', paidDate: '--' },
];

const invoiceColumns: Column<(typeof mockInvoices)[0]>[] = [
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
];

/**
 * Admin Billing & Financials Page
 * Summary KPIs + Tabs: All Invoices, Pending, Paid, Overdue.
 */
export const BillingFinancials = () => {
  const pending = mockInvoices.filter((i) => ['sent', 'draft', 'partially_paid'].includes(i.status));
  const paid = mockInvoices.filter((i) => i.status === 'paid');
  const overdue = mockInvoices.filter((i) => i.status === 'overdue');

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & Financials" description="Manage invoices and track payments">
        <ExportButton data={mockInvoices} filename="invoices-export" />
      </PageHeader>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Invoices ({mockInvoices.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="paid">Paid ({paid.length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <DataTable data={mockInvoices} columns={invoiceColumns} searchPlaceholder="Search invoices..." />
        </TabsContent>

        <TabsContent value="pending">
          <DataTable data={pending} columns={invoiceColumns} searchPlaceholder="Search pending invoices..." />
        </TabsContent>

        <TabsContent value="paid">
          <DataTable data={paid} columns={invoiceColumns} searchPlaceholder="Search paid invoices..." />
        </TabsContent>

        <TabsContent value="overdue">
          <DataTable data={overdue} columns={invoiceColumns} searchPlaceholder="Search overdue invoices..." />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BillingFinancials;
