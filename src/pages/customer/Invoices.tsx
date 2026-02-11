import { useState, useEffect } from 'react';
import { PageHeader, DataTable, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { getInvoices } from '@/services/invoiceService';
import type { Invoice } from '@/types';

export const Invoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    getInvoices({ customerId: user.id, page: 1, limit: 50 })
      .then((res) => setInvoices(res.data))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const pending = invoices.filter((i) => ['sent', 'draft', 'partially_paid'].includes(i.status));
  const paid = invoices.filter((i) => i.status === 'paid');
  const overdue = invoices.filter((i) => i.status === 'overdue');

  const columns: Column<Invoice>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', sortable: true },
    {
      key: 'total',
      header: 'Amount (KES)',
      sortable: true,
      render: (row) => <span className="font-medium">KES {row.total.toLocaleString()}</span>,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'issuedAt', header: 'Issued', sortable: true },
    { key: 'dueAt', header: 'Due Date', sortable: true },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoices" description="View your invoices and payment status" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="View your invoices and payment status" />

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All ({invoices.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="paid">Paid ({paid.length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <DataTable data={invoices} columns={columns} searchPlaceholder="Search invoices..." />
        </TabsContent>
        <TabsContent value="pending">
          <DataTable data={pending} columns={columns} searchPlaceholder="Search pending..." />
        </TabsContent>
        <TabsContent value="paid">
          <DataTable data={paid} columns={columns} searchPlaceholder="Search paid..." />
        </TabsContent>
        <TabsContent value="overdue">
          <DataTable data={overdue} columns={columns} searchPlaceholder="Search overdue..." />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Invoices;
