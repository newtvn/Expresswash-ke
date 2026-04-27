import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  FileText, Plus, Download, MessageSquare, CheckCircle2, Clock, AlertCircle,
  Search, Eye, Edit2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// ---------- Types ----------

type PaymentStatus = 'paid' | 'pending' | 'partial' | 'overdue';

interface Invoice {
  id: string;
  invoice_number: string;
  order_id?: string;
  order_tracking_code?: string;
  customer_name: string;
  customer_phone?: string;
  items: Array<{ name: string; quantity: number; unit_price: number; total: number }>;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  paid_amount: number;
  balance: number;
  status: PaymentStatus;
  due_date: string;
  created_at: string;
  notes?: string;
}

interface InvoiceTemplate {
  id: string;
  name: string;
  header_text: string;
  footer_text: string;
  payment_terms: string;
  bank_details: string;
  created_at: string;
}

// ---------- Service helpers ----------

async function fetchInvoices(): Promise<Invoice[]> {
  const { data } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });
  return (data ?? []).map(mapInvoice);
}

function mapInvoice(row: Record<string, unknown>): Invoice {
  const total = (row.total as number) ?? 0;
  const paidAmount = (row.paid_amount as number) ?? 0;
  return {
    id: row.id as string,
    invoice_number: row.invoice_number as string,
    order_id: (row.order_id as string) ?? undefined,
    order_tracking_code: (row.order_tracking_code as string) ?? undefined,
    customer_name: row.customer_name as string,
    customer_phone: (row.customer_phone as string) ?? undefined,
    items: (row.items as Invoice['items']) ?? [],
    subtotal: (row.subtotal as number) ?? 0,
    vat_rate: (row.vat_rate as number) ?? 0.16,
    vat_amount: (row.vat_amount as number) ?? 0,
    total,
    paid_amount: paidAmount,
    balance: total - paidAmount,
    status: (row.status as PaymentStatus) ?? 'pending',
    due_date: row.due_date as string,
    created_at: row.created_at as string,
    notes: (row.notes as string) ?? undefined,
  };
}

async function fetchTemplates(): Promise<InvoiceTemplate[]> {
  const { data } = await supabase.from('invoice_templates').select('*').order('created_at', { ascending: false });
  return (data ?? []) as InvoiceTemplate[];
}

async function updateInvoicePayment(id: string, paidAmount: number, total: number): Promise<void> {
  let status: PaymentStatus = 'pending';
  if (paidAmount >= total) status = 'paid';
  else if (paidAmount > 0) status = 'partial';
  const { error } = await supabase.from('invoices').update({ paid_amount: paidAmount, balance: total - paidAmount, status }).eq('id', id);
  if (error) throw new Error(error.message);
}

async function createInvoiceFromOrder(orderId: string): Promise<{ success: boolean; invoiceNumber?: string; error?: string }> {
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();

  if (orderErr || !order) return { success: false, error: 'Order not found' };

  const vatRate = 0.16;
  const items = ((order.order_items as Record<string, unknown>[]) ?? []).map((i) => ({
    name: i.name as string,
    quantity: i.quantity as number,
    unit_price: i.unit_price as number,
    total: i.total_price as number,
  }));

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const vatAmount = Math.round(subtotal * vatRate);
  const total = subtotal + vatAmount + ((order.delivery_fee as number) ?? 0);

  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const { error } = await supabase.from('invoices').insert({
    invoice_number: invoiceNumber,
    order_id: orderId,
    order_tracking_code: order.tracking_code as string,
    customer_name: order.customer_name as string,
    customer_phone: (order.customer_phone as string) ?? null,
    items,
    subtotal,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    total,
    paid_amount: 0,
    balance: total,
    status: 'pending',
    due_date: dueDate.toISOString().split('T')[0],
    created_at: new Date().toISOString(),
  });

  if (error) return { success: false, error: error.message };
  return { success: true, invoiceNumber };
}

async function saveTemplate(template: Omit<InvoiceTemplate, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('invoice_templates').insert({ ...template, created_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// ---------- Helpers ----------

const STATUS_CONFIG: Record<PaymentStatus, { label: string; icon: React.ElementType; className: string }> = {
  paid: { label: 'Paid', icon: CheckCircle2, className: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', icon: Clock, className: 'bg-yellow-100 text-yellow-700' },
  partial: { label: 'Partial', icon: AlertCircle, className: 'bg-blue-100 text-blue-700' },
  overdue: { label: 'Overdue', icon: AlertCircle, className: 'bg-red-100 text-red-700' },
};

function openWhatsApp(phone: string, invoiceNumber: string) {
  const msg = encodeURIComponent(
    `Hi, please find your invoice ${invoiceNumber} from Express Carpets attached. Thank you for your business!`,
  );
  const cleaned = phone.replace(/\D/g, '');
  const intl = cleaned.startsWith('0') ? '254' + cleaned.slice(1) : cleaned;
  window.open(`https://wa.me/${intl}?text=${msg}`, '_blank');
}

// ---------- Component ----------

export const AdminInvoices = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', header_text: '', footer_text: '', payment_terms: 'Net 14 days', bank_details: '' });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['admin', 'invoices'],
    queryFn: fetchInvoices,
    refetchInterval: 30000,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['admin', 'invoice-templates'],
    queryFn: fetchTemplates,
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, amount, total }: { id: string; amount: number; total: number }) =>
      updateInvoicePayment(id, amount, total),
    onSuccess: () => {
      toast.success('Payment status updated');
      setPaymentDialogOpen(false);
      setPaymentAmount('');
      setSelectedInvoice(null);
      qc.invalidateQueries({ queryKey: ['admin', 'invoices'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const templateMutation = useMutation({
    mutationFn: saveTemplate,
    onSuccess: () => {
      toast.success('Template saved');
      setTemplateDialogOpen(false);
      setTemplateForm({ name: '', header_text: '', footer_text: '', payment_terms: 'Net 14 days', bank_details: '' });
      qc.invalidateQueries({ queryKey: ['admin', 'invoice-templates'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = invoices.filter((inv) => {
    const matchSearch = !search || inv.customer_name.toLowerCase().includes(search.toLowerCase()) || inv.invoice_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totals = {
    paid: invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0),
    pending: invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.balance, 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Manage all invoices, templates, and payment tracking">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Template
          </Button>
        </div>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoices', value: invoices.length, fmt: (v: number) => String(v) },
          { label: 'Paid', value: invoices.filter((i) => i.status === 'paid').length, fmt: (v: number) => String(v) },
          { label: 'Outstanding', value: totals.pending, fmt: (v: number) => `KES ${v.toLocaleString()}` },
          { label: 'Total Received', value: totals.paid, fmt: (v: number) => `KES ${v.toLocaleString()}` },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.fmt(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="all-invoices">
        <TabsList>
          <TabsTrigger value="all-invoices">All Invoices</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* ALL INVOICES */}
        <TabsContent value="all-invoices" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 w-64" placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
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
              {filtered.map((inv) => {
                const st = STATUS_CONFIG[inv.status];
                return (
                  <Card key={inv.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                    <CardContent className="py-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{inv.invoice_number}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${st.className}`}>
                              <st.icon className="h-3 w-3" />
                              {st.label}
                            </span>
                            {inv.order_tracking_code && (
                              <Badge variant="outline" className="text-xs">#{inv.order_tracking_code}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{inv.customer_name}</p>
                          {inv.status === 'partial' && (
                            <p className="text-xs text-blue-600 mt-0.5">
                              Paid: KES {inv.paid_amount.toLocaleString()} · Balance: KES {inv.balance.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold">KES {inv.total.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Due {new Date(inv.due_date).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              title="Update payment"
                              onClick={() => { setSelectedInvoice(inv); setPaymentAmount(String(inv.paid_amount)); setPaymentDialogOpen(true); }}
                            >
                              <Edit2 className="h-3 w-3 mr-1" /> Payment
                            </Button>
                            {inv.customer_phone && (
                              <Button size="sm" variant="outline" title="Send via WhatsApp" onClick={() => openWhatsApp(inv.customer_phone!, inv.invoice_number)}>
                                <MessageSquare className="h-3 w-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="outline" title="Download PDF" onClick={() => toast.info('PDF generation ready — connect to generate-pdf edge function')}>
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

        {/* OVERDUE */}
        <TabsContent value="overdue" className="mt-4">
          <div className="space-y-2">
            {invoices.filter((i) => i.status === 'overdue' || (i.status !== 'paid' && new Date(i.due_date) < new Date())).map((inv) => (
              <Card key={inv.id} className="border-red-200">
                <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{inv.invoice_number}</span>
                      <Badge variant="destructive" className="text-xs">Overdue</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{inv.customer_name}</p>
                    <p className="text-xs text-red-600 mt-0.5">Due: {new Date(inv.due_date).toLocaleDateString()} · Balance: KES {inv.balance.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {inv.customer_phone && (
                      <Button size="sm" variant="outline" onClick={() => openWhatsApp(inv.customer_phone!, inv.invoice_number)}>
                        <MessageSquare className="h-3 w-3 mr-1" /> Remind
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => { setSelectedInvoice(inv); setPaymentAmount(String(inv.paid_amount)); setPaymentDialogOpen(true); }}>
                      Mark Paid
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {invoices.filter((i) => i.status === 'overdue' || (i.status !== 'paid' && new Date(i.due_date) < new Date())).length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No overdue invoices</p></CardContent></Card>
            )}
          </div>
        </TabsContent>

        {/* TEMPLATES */}
        <TabsContent value="templates" className="mt-4">
          <div className="space-y-3">
            <Button onClick={() => setTemplateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Template
            </Button>
            {templates.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No templates yet</p></CardContent></Card>
            ) : templates.map((t) => (
              <Card key={t.id}>
                <CardContent className="py-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.payment_terms}</p>
                  </div>
                  <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* View Invoice Dialog */}
      {selectedInvoice && !paymentDialogOpen && (
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{selectedInvoice.invoice_number}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-medium ${STATUS_CONFIG[selectedInvoice.status].className}`}>
                  {STATUS_CONFIG[selectedInvoice.status].label}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Customer:</span><p className="font-medium">{selectedInvoice.customer_name}</p></div>
                <div><span className="text-muted-foreground">Phone:</span><p className="font-medium">{selectedInvoice.customer_phone ?? '—'}</p></div>
                <div><span className="text-muted-foreground">Order:</span><p className="font-medium">{selectedInvoice.order_tracking_code ?? '—'}</p></div>
                <div><span className="text-muted-foreground">Due Date:</span><p className="font-medium">{new Date(selectedInvoice.due_date).toLocaleDateString()}</p></div>
              </div>
              <Separator />
              <div className="space-y-2">
                {selectedInvoice.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.name}</span>
                    <span>KES {item.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>KES {selectedInvoice.subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">VAT ({(selectedInvoice.vat_rate * 100).toFixed(0)}%)</span><span>KES {selectedInvoice.vat_amount.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-base pt-1"><span>Total</span><span>KES {selectedInvoice.total.toLocaleString()}</span></div>
                {selectedInvoice.status === 'partial' && (
                  <>
                    <div className="flex justify-between text-green-600"><span>Amount Paid</span><span>KES {selectedInvoice.paid_amount.toLocaleString()}</span></div>
                    <div className="flex justify-between text-red-600 font-semibold"><span>Balance Due</span><span>KES {selectedInvoice.balance.toLocaleString()}</span></div>
                  </>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setPaymentAmount(String(selectedInvoice.paid_amount)); setPaymentDialogOpen(true); }}>
                <Edit2 className="h-4 w-4 mr-2" /> Update Payment
              </Button>
              {selectedInvoice.customer_phone && (
                <Button variant="outline" onClick={() => openWhatsApp(selectedInvoice.customer_phone!, selectedInvoice.invoice_number)}>
                  <MessageSquare className="h-4 w-4 mr-2" /> Send WhatsApp
                </Button>
              )}
              <Button onClick={() => toast.info('PDF generation — connect generate-pdf edge function')}>
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Payment Update Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={(open) => { setPaymentDialogOpen(open); if (!open) setPaymentAmount(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment — {selectedInvoice?.invoice_number}</DialogTitle>
            <DialogDescription>Set the amount paid. Mark as Paid (full), Partial (part), or Pending (none).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-muted text-center"><p className="text-muted-foreground text-xs">Invoice Total</p><p className="font-bold">KES {selectedInvoice?.total.toLocaleString()}</p></div>
              <div className="p-3 rounded-lg bg-muted text-center"><p className="text-muted-foreground text-xs">Previously Paid</p><p className="font-bold">KES {selectedInvoice?.paid_amount.toLocaleString()}</p></div>
              <div className="p-3 rounded-lg bg-muted text-center"><p className="text-muted-foreground text-xs">Balance</p><p className="font-bold">KES {selectedInvoice?.balance.toLocaleString()}</p></div>
            </div>
            <div>
              <Label>Amount Paid (KES) *</Label>
              <Input
                type="number"
                min="0"
                max={selectedInvoice?.total}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter total amount paid so far"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the total amount paid so far (not just this payment). Full amount = Paid, partial = Partial, 0 = Pending.
              </p>
            </div>
            {paymentAmount && selectedInvoice && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                {parseFloat(paymentAmount) >= selectedInvoice.total
                  ? <p className="text-green-600 font-medium">✓ Will be marked as Paid</p>
                  : parseFloat(paymentAmount) > 0
                  ? <p className="text-blue-600 font-medium">Balance remaining: KES {(selectedInvoice.total - parseFloat(paymentAmount)).toLocaleString()} — Partial Payment</p>
                  : <p className="text-muted-foreground">Will be marked as Pending</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={paymentMutation.isPending || !paymentAmount}
              onClick={() => {
                if (!selectedInvoice) return;
                paymentMutation.mutate({ id: selectedInvoice.id, amount: parseFloat(paymentAmount) || 0, total: selectedInvoice.total });
              }}
            >
              {paymentMutation.isPending ? 'Saving...' : 'Save Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New Invoice Template</DialogTitle>
            <DialogDescription>Create a reusable template for your invoices</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Template Name *</Label>
              <Input value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Standard Invoice" />
            </div>
            <div>
              <Label>Header Text</Label>
              <Textarea value={templateForm.header_text} onChange={(e) => setTemplateForm((p) => ({ ...p, header_text: e.target.value }))} rows={2} placeholder="Company address, registration, VAT number..." />
            </div>
            <div>
              <Label>Payment Terms</Label>
              <Input value={templateForm.payment_terms} onChange={(e) => setTemplateForm((p) => ({ ...p, payment_terms: e.target.value }))} placeholder="Net 14 days" />
            </div>
            <div>
              <Label>Bank / M-Pesa Details</Label>
              <Textarea value={templateForm.bank_details} onChange={(e) => setTemplateForm((p) => ({ ...p, bank_details: e.target.value }))} rows={2} placeholder="M-Pesa: 0700 XXX XXX (Express Carpets)&#10;Bank: Equity, A/C XXXXXXXX" />
            </div>
            <div>
              <Label>Footer Text</Label>
              <Textarea value={templateForm.footer_text} onChange={(e) => setTemplateForm((p) => ({ ...p, footer_text: e.target.value }))} rows={2} placeholder="Thank you for your business!" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={templateMutation.isPending || !templateForm.name}
              onClick={() => templateMutation.mutate(templateForm)}
            >
              {templateMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInvoices;
