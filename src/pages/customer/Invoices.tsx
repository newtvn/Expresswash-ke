import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getInvoices } from '@/services/invoiceService';
import { InvoiceDownloadButton } from '@/components/shared';

export const Invoices = () => {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: result, isLoading } = useQuery({
    queryKey: ['customer', 'invoices', user?.id, statusFilter],
    queryFn: () =>
      getInvoices({
        customerId: user?.id,
        status: statusFilter !== 'all' ? (statusFilter as 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled') : undefined,
        page: 1,
        limit: 50,
      }),
    enabled: !!user?.id,
  });

  const invoices = result?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="View and download your invoices" />

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-44"><SelectValue placeholder="All Statuses" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="sent">Pending</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No invoices found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{inv.invoiceNumber}</span>
                    <StatusBadge status={inv.status} />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Order: {inv.orderNumber}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Due: {inv.dueAt?.split('T')[0]}</span>
                    <span className="font-medium text-foreground">KES {inv.total.toLocaleString()}</span>
                  </div>
                </div>
                <InvoiceDownloadButton invoiceId={inv.id} pdfUrl={inv.pdfUrl} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Invoices;
