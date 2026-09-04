import { AlertCircle, CheckCircle2, Clock, Download, Edit2, Eye, FileText, MessageSquare, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Invoice, InvoiceStatus, InvoiceTemplate } from '@/pages/admin/AdminInvoices';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; icon: React.ElementType; className: string }> = {
  draft: { label: 'Draft', icon: FileText, className: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Sent', icon: Clock, className: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', icon: CheckCircle2, className: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', icon: Clock, className: 'bg-yellow-100 text-yellow-700' },
  partial: { label: 'Partial', icon: AlertCircle, className: 'bg-blue-100 text-blue-700' },
  partially_paid: { label: 'Partial', icon: AlertCircle, className: 'bg-blue-100 text-blue-700' },
  overdue: { label: 'Overdue', icon: AlertCircle, className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', icon: AlertCircle, className: 'bg-gray-100 text-gray-700' },
};

interface InvoiceListTabsProps {
  invoices: Invoice[];
  filtered: Invoice[];
  templates: InvoiceTemplate[];
  isLoading: boolean;
  search: string;
  statusFilter: 'all' | InvoiceStatus;
  postInvoicePending: boolean;
  whatsappPending: boolean;
  pdfPending: boolean;
  setSearch: (value: string) => void;
  setStatusFilter: (value: 'all' | InvoiceStatus) => void;
  formatDate: (value?: string | null) => string;
  invoiceCanBeEdited: (invoice: Invoice) => boolean;
  isPartialStatus: (status: InvoiceStatus) => boolean;
  isPastDue: (invoice: Invoice) => boolean;
  onSelectInvoice: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice, amount?: string) => void;
  onEditInvoice: (invoice: Invoice) => void;
  onPostInvoice: (invoiceId: string) => void;
  onQueueWhatsApp: (invoice: Invoice) => void;
  onDownloadPdf: (invoiceId: string) => void;
  onOpenTemplateDialog: () => void;
  onOpenWhatsAppReminder: (phone: string, invoiceNumber: string) => void;
}

export function InvoiceListTabs({
  invoices,
  filtered,
  templates,
  isLoading,
  search,
  statusFilter,
  postInvoicePending,
  whatsappPending,
  pdfPending,
  setSearch,
  setStatusFilter,
  formatDate,
  invoiceCanBeEdited,
  isPartialStatus,
  isPastDue,
  onSelectInvoice,
  onRecordPayment,
  onEditInvoice,
  onPostInvoice,
  onQueueWhatsApp,
  onDownloadPdf,
  onOpenTemplateDialog,
  onOpenWhatsAppReminder,
}: InvoiceListTabsProps) {
  const overdueInvoices = invoices.filter((invoice) => invoice.status === 'overdue' || isPastDue(invoice));

  return (
    <Tabs defaultValue="all-invoices">
      <TabsList>
        <TabsTrigger value="all-invoices">All Invoices</TabsTrigger>
        <TabsTrigger value="overdue">Overdue</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
      </TabsList>

      <TabsContent value="all-invoices" className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="w-full pl-9 sm:w-64" placeholder="Search invoices..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | InvoiceStatus)}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading invoices...</p>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No invoices found</p></CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((invoice) => {
              const status = STATUS_CONFIG[invoice.status];
              return (
                <Card key={invoice.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => onSelectInvoice(invoice)}>
                  <CardContent className="p-4 sm:px-6 sm:py-3">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                          <span className="break-words text-base font-semibold leading-snug">{invoice.invoice_number}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${status.className}`}>
                              <status.icon className="h-3 w-3" />
                              {status.label}
                            </span>
                            {invoice.posted_journal_entry_id && <Badge variant="outline" className="text-xs">Posted</Badge>}
                            {invoice.order_tracking_code && (
                              <Badge variant="outline" className="max-w-full truncate text-xs">#{invoice.order_tracking_code}</Badge>
                            )}
                          </div>
                        </div>
                        <p className="mt-1.5 break-words text-sm text-muted-foreground">{invoice.customer_name}</p>
                        {isPartialStatus(invoice.status) && (
                          <p className="mt-2 inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                            Paid: KES {invoice.paid_amount.toLocaleString()} · Balance: KES {invoice.balance.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-3 border-t pt-3 sm:shrink-0 sm:flex-row sm:items-end sm:border-0 sm:pt-0">
                        <div className="shrink-0 sm:text-right">
                          <p className="text-lg font-bold leading-tight">KES {invoice.total.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Due {formatDate(invoice.due_date)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end" onClick={(event) => event.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            title="Update payment"
                            onClick={() => onRecordPayment(invoice)}
                          >
                            <Edit2 className="h-3 w-3 mr-1" /> Payment
                          </Button>
                          {invoiceCanBeEdited(invoice) && (
                            <Button size="sm" variant="outline" title="Edit invoice" onClick={() => onEditInvoice(invoice)}>
                              Edit
                            </Button>
                          )}
                          {!invoice.posted_journal_entry_id && invoice.status !== 'draft' && invoice.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={postInvoicePending}
                              title="Post to ledger"
                              onClick={() => onPostInvoice(invoice.id)}
                            >
                              Post
                            </Button>
                          )}
                          {invoice.customer_phone && (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Queue WhatsApp invoice"
                              disabled={whatsappPending}
                              onClick={() => onQueueWhatsApp(invoice)}
                            >
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            title="Download PDF"
                            aria-label={`Download ${invoice.invoice_number} PDF`}
                            disabled={pdfPending}
                            onClick={() => onDownloadPdf(invoice.id)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="overdue" className="mt-4">
        <div className="space-y-2">
          {overdueInvoices.map((invoice) => (
            <Card key={invoice.id} className="border-red-200">
              <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:px-6 sm:py-3">
                <div className="min-w-0">
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                    <span className="break-words text-base font-semibold leading-snug">{invoice.invoice_number}</span>
                    <Badge variant="destructive" className="text-xs">Overdue</Badge>
                  </div>
                  <p className="mt-1.5 break-words text-sm text-muted-foreground">{invoice.customer_name}</p>
                  <p className="mt-2 inline-flex rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">Due {formatDate(invoice.due_date)} · Balance KES {invoice.balance.toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2 border-t pt-3 sm:shrink-0 sm:border-0 sm:pt-0" onClick={(event) => event.stopPropagation()}>
                  {invoice.customer_phone && (
                    <Button size="sm" variant="outline" onClick={() => onOpenWhatsAppReminder(invoice.customer_phone!, invoice.invoice_number)}>
                      <MessageSquare className="h-3 w-3 mr-1" /> Remind
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => onRecordPayment(invoice, String(invoice.balance))}>
                    Mark Paid
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {overdueInvoices.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No overdue invoices</p></CardContent></Card>
          )}
        </div>
      </TabsContent>

      <TabsContent value="templates" className="mt-4">
        <div className="space-y-3">
          <Button onClick={onOpenTemplateDialog}>
            <Plus className="h-4 w-4 mr-2" /> New Template
          </Button>
          {templates.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No templates yet</p></CardContent></Card>
          ) : templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{template.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{template.payment_terms}</p>
                </div>
                <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
