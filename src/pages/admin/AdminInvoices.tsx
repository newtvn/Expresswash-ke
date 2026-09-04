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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  FileText, Plus, Download, MessageSquare, CheckCircle2, Clock, AlertCircle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { InvoiceListTabs } from '@/components/admin/invoices/InvoiceListTabs';
import {
  createAccountingInvoice,
  createInvoiceCreditNote,
  getAccountingSetup,
  postInvoiceLedgerEntry,
  updateDraftAccountingInvoice,
} from '@/services/accounting/application';
import { enqueueNotification } from '@/services/accounting/outbox';
import type { AccountingItem, ChartAccount, Contact, InvoiceLineInput, TaxRate } from '@/types/accounting';

// ---------- Types ----------

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'pending' | 'partial' | 'partially_paid' | 'overdue' | 'cancelled';
type PaymentMethod = 'mpesa' | 'cash' | 'card' | 'bank_transfer' | 'qr_code';

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id?: string;
  order_tracking_code?: string;
  customer_name: string;
  customer_phone?: string;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
    item_id?: string;
    discount_amount?: number;
    tax_rate_id?: string;
    tax_amount?: number;
    revenue_account_id?: string;
  }>;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  paid_amount: number;
  balance: number;
  posted_journal_entry_id?: string;
  status: InvoiceStatus;
  due_date: string;
  created_at: string;
  notes?: string;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  header_text: string;
  footer_text: string;
  payment_terms: string;
  bank_details: string;
  created_at: string;
}

type InvoiceFormLine = {
  id: string;
  itemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxRateId: string;
  taxAmount: string;
  revenueAccountId: string;
};

// ---------- Service helpers ----------

async function fetchInvoices(): Promise<Invoice[]> {
  const { data } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  const invoices = (data ?? []).map(mapInvoice);
  const invoiceIds = invoices.map((invoice) => invoice.id);

  if (invoiceIds.length === 0) return invoices;

  const { data: lines } = await supabase
    .from('invoice_lines')
    .select('invoice_id,item_id,description_snapshot,quantity,unit_price,discount_amount,tax_rate_id,tax_amount,line_total,revenue_account_id,created_at')
    .in('invoice_id', invoiceIds)
    .order('created_at', { ascending: true });

  const linesByInvoice = new Map<string, Invoice['items']>();
  (lines ?? []).forEach((row) => {
    const invoiceId = row.invoice_id as string;
    const current = linesByInvoice.get(invoiceId) ?? [];
    current.push({
      name: String(row.description_snapshot ?? ''),
      quantity: toAmount(row.quantity || 1),
      unit_price: toAmount(row.unit_price),
      total: toAmount(row.line_total),
      item_id: (row.item_id as string) ?? undefined,
      discount_amount: toAmount(row.discount_amount),
      tax_rate_id: (row.tax_rate_id as string) ?? undefined,
      tax_amount: toAmount(row.tax_amount),
      revenue_account_id: (row.revenue_account_id as string) ?? undefined,
    });
    linesByInvoice.set(invoiceId, current);
  });

  return invoices.map((invoice) => ({
    ...invoice,
    items: linesByInvoice.get(invoice.id) ?? invoice.items,
  }));
}

const toAmount = (value: unknown): number => {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const normalizeVatRate = (value: unknown): number => {
  const rate = toAmount(value ?? 0.16);
  return rate > 1 ? rate / 100 : rate;
};

const normalizeInvoiceItems = (items: unknown): Invoice['items'] => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      name: String(row.name ?? row.description ?? ''),
      quantity: toAmount(row.quantity || 1),
      unit_price: toAmount(row.unit_price ?? row.unitPrice),
      total: toAmount(row.total),
    };
  });
};

const formatDate = (value?: string | null): string => {
  if (!value) return 'No date';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};

function mapInvoice(row: Record<string, unknown>): Invoice {
  const total = toAmount(row.total);
  const paidAmount = toAmount(row.paid_amount);
  const storedBalance = row.balance === null || row.balance === undefined ? undefined : toAmount(row.balance);
  return {
    id: row.id as string,
    invoice_number: row.invoice_number as string,
    order_id: (row.order_id as string) ?? undefined,
    order_tracking_code: (row.order_tracking_code as string) ?? undefined,
    customer_name: row.customer_name as string,
    customer_phone: (row.customer_phone as string) ?? undefined,
    items: normalizeInvoiceItems(row.items),
    subtotal: toAmount(row.subtotal),
    vat_rate: normalizeVatRate(row.vat_rate),
    vat_amount: toAmount(row.vat_amount),
    total,
    paid_amount: paidAmount,
    balance: storedBalance ?? Math.max(total - paidAmount, 0),
    posted_journal_entry_id: (row.posted_journal_entry_id as string) ?? undefined,
    status: (row.status as InvoiceStatus) ?? 'pending',
    due_date: (row.due_date as string) ?? (row.due_at as string) ?? '',
    created_at: (row.created_at as string) ?? (row.issued_at as string),
    notes: (row.notes as string) ?? undefined,
  };
}

async function fetchTemplates(): Promise<InvoiceTemplate[]> {
  const { data } = await supabase.from('invoice_templates').select('*').order('created_at', { ascending: false });
  return (data ?? []) as InvoiceTemplate[];
}

async function recordInvoicePayment(payload: {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  recordedBy?: string;
}): Promise<void> {
  const { data, error } = await supabase.rpc('record_invoice_payment', {
    p_invoice_id: payload.invoiceId,
    p_amount: payload.amount,
    p_method: payload.method,
    p_reference: payload.reference || null,
    p_recorded_by: payload.recordedBy || null,
    p_notes: null,
  });
  if (error) throw new Error(error.message);
  const result = data as { success?: boolean; error?: unknown } | null;
  if (result?.success === false) {
    const message = String(result.error ?? 'Failed to record invoice payment');
    if (message.includes('payment_method') && message.includes('M-Pesa')) {
      throw new Error('Payment was not recorded because the live database still has the legacy payment notification trigger. Apply migration 062, then retry.');
    }
    throw new Error(message);
  }
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
    name: String(i.name ?? i.description ?? 'Service'),
    quantity: toAmount(i.quantity || 1),
    unit_price: toAmount(i.unit_price),
    total: toAmount(i.total_price ?? i.total),
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
    order_number: (order.order_number as string) ?? (order.tracking_code as string) ?? invoiceNumber,
    order_tracking_code: order.tracking_code as string,
    customer_id: (order.customer_id as string) ?? null,
    customer_name: order.customer_name as string,
    customer_email: (order.customer_email as string) ?? '',
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
    due_at: dueDate.toISOString(),
    issued_at: new Date().toISOString(),
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

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'qr_code', label: 'QR Code' },
];

const makeInvoiceLine = (): InvoiceFormLine => ({
  id: crypto.randomUUID(),
  itemId: '',
  description: '',
  quantity: '1',
  unitPrice: '',
  discountAmount: '',
  taxRateId: '',
  taxAmount: '',
  revenueAccountId: '',
});

const calculateInvoiceLine = (line: InvoiceFormLine, taxRates: TaxRate[]) => {
  const quantity = toAmount(line.quantity || 1);
  const unitPrice = toAmount(line.unitPrice);
  const discount = toAmount(line.discountAmount);
  const base = Math.max(quantity * unitPrice - discount, 0);
  const selectedTaxRate = taxRates.find((taxRate) => taxRate.id === line.taxRateId);
  const taxAmount = line.taxAmount === ''
    ? Math.round(base * (selectedTaxRate?.rate ?? 0) * 100) / 100
    : toAmount(line.taxAmount);
  return {
    base,
    taxAmount,
    total: Math.round((base + taxAmount) * 100) / 100,
  };
};

const invoiceLineToInput = (line: InvoiceFormLine): InvoiceLineInput => ({
  itemId: line.itemId || undefined,
  description: line.description,
  quantity: toAmount(line.quantity || 1),
  unitPrice: toAmount(line.unitPrice),
  discountAmount: toAmount(line.discountAmount),
  taxRateId: line.taxRateId || undefined,
  taxAmount: line.taxAmount === '' ? undefined : toAmount(line.taxAmount),
  revenueAccountId: line.revenueAccountId || undefined,
});

const invoiceCanBeEdited = (invoice: Invoice): boolean => (
  invoice.status === 'draft'
  && !invoice.posted_journal_entry_id
  && toAmount(invoice.paid_amount) <= 0
  && toAmount(invoice.balance) >= 0
);

const hasOutstandingBalance = (invoice: Invoice): boolean => invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.balance > 0;
const isPartialStatus = (status: InvoiceStatus): boolean => status === 'partial' || status === 'partially_paid';
const isPastDue = (invoice: Invoice): boolean => {
  if (!hasOutstandingBalance(invoice) || !invoice.due_date) return false;
  const dueDate = new Date(invoice.due_date);
  return !Number.isNaN(dueDate.getTime()) && dueDate < new Date();
};

function openWhatsApp(phone: string, invoiceNumber: string) {
  const msg = encodeURIComponent(
    `Hi, please find your invoice ${invoiceNumber} from Express Carpets attached. Thank you for your business!`,
  );
  const cleaned = phone.replace(/\D/g, '');
  const intl = cleaned.startsWith('0') ? '254' + cleaned.slice(1) : cleaned;
  window.open(`https://wa.me/${intl}?text=${msg}`, '_blank');
}

async function generateInvoicePdf(invoiceId: string) {
  const { data, error } = await supabase.functions.invoke('generate-pdf', {
    body: { type: 'invoice', id: invoiceId },
  });

  if (error) throw new Error(error.message);
  const url = (data as { url?: string })?.url;
  if (!url) throw new Error('PDF function did not return a signed URL');
  window.open(url, '_blank');
}

// ---------- Component ----------

export const AdminInvoices = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    contactId: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    status: 'pending' as 'draft' | 'pending' | 'sent',
    post: false,
    lines: [makeInvoiceLine()],
  });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa');
  const [paymentReference, setPaymentReference] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
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

  const { data: accountingSetup } = useQuery({
    queryKey: ['accounting', 'setup'],
    queryFn: getAccountingSetup,
  });

  const contacts = accountingSetup?.contacts ?? [];
  const customerContacts = contacts.filter((contact) => contact.contactType === 'customer' || contact.contactType === 'both');
  const accountingItems = accountingSetup?.items ?? [];
  const taxRates = accountingSetup?.taxRates ?? [];
  const incomeAccounts = (accountingSetup?.accounts ?? []).filter((account) => account.accountType === 'income');

  const invoiceTotals = invoiceForm.lines.reduce((totals, line) => {
    const calculated = calculateInvoiceLine(line, taxRates);
    return {
      subtotal: totals.subtotal + calculated.base,
      tax: totals.tax + calculated.taxAmount,
      total: totals.total + calculated.total,
    };
  }, { subtotal: 0, tax: 0, total: 0 });

  const paymentMutation = useMutation({
    mutationFn: recordInvoicePayment,
    onSuccess: () => {
      toast.success('Payment recorded');
      setPaymentDialogOpen(false);
      setPaymentAmount('');
      setPaymentMethod('mpesa');
      setPaymentReference('');
      setSelectedInvoice(null);
      qc.invalidateQueries({ queryKey: ['admin', 'invoices'] });
      qc.invalidateQueries({ queryKey: ['accounting'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invoiceMutation = useMutation({
    mutationFn: () => {
      const payload = {
        contactId: invoiceForm.contactId,
        issueDate: invoiceForm.issueDate,
        dueDate: invoiceForm.dueDate || undefined,
        notes: invoiceForm.notes || undefined,
        status: invoiceForm.status,
        post: invoiceForm.post,
        lines: invoiceForm.lines.map(invoiceLineToInput),
      };

      return editingInvoice
        ? updateDraftAccountingInvoice({ ...payload, invoiceId: editingInvoice.id })
        : createAccountingInvoice(payload);
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save invoice');
        return;
      }
      toast.success(editingInvoice ? 'Invoice updated' : `Invoice ${result.invoiceNumber ?? ''} created`);
      setInvoiceDialogOpen(false);
      resetInvoiceForm();
      qc.invalidateQueries({ queryKey: ['admin', 'invoices'] });
      qc.invalidateQueries({ queryKey: ['accounting'] });
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

  const postInvoiceMutation = useMutation({
    mutationFn: postInvoiceLedgerEntry,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to post invoice');
        return;
      }
      toast.success(result.idempotent ? 'Invoice was already posted' : 'Invoice posted to ledger');
      qc.invalidateQueries({ queryKey: ['admin', 'invoices'] });
      qc.invalidateQueries({ queryKey: ['accounting'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const creditNoteMutation = useMutation({
    mutationFn: createInvoiceCreditNote,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to create credit note');
        return;
      }
      toast.success(`Credit note ${result.creditNoteNumber ?? ''} created`);
      setCreditDialogOpen(false);
      setCreditAmount('');
      setCreditReason('');
      setSelectedInvoice(null);
      qc.invalidateQueries({ queryKey: ['admin', 'invoices'] });
      qc.invalidateQueries({ queryKey: ['accounting'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pdfMutation = useMutation({
    mutationFn: generateInvoicePdf,
    onSuccess: () => toast.success('Invoice PDF generated'),
    onError: (e: Error) => toast.error(e.message),
  });

  const whatsappOutboxMutation = useMutation({
    mutationFn: async (invoice: Invoice) => {
      if (!invoice.customer_phone) {
        throw new Error('Customer phone is required for WhatsApp delivery');
      }

      return enqueueNotification({
        eventType: 'invoice.sent',
        aggregateType: 'invoice',
        aggregateId: invoice.id,
        channel: 'whatsapp',
        recipientContact: invoice.customer_phone,
        recipientName: invoice.customer_name,
        payload: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          customer_name: invoice.customer_name,
          total: invoice.total,
          balance: invoice.balance,
        },
        idempotencyKey: `invoice-whatsapp-${invoice.id}`,
      });
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to queue WhatsApp notification');
        return;
      }
      toast.success('Invoice WhatsApp delivery queued');
      qc.invalidateQueries({ queryKey: ['accounting', 'notification-outbox'] });
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
    pending: invoices.filter(hasOutstandingBalance).reduce((s, i) => s + i.balance, 0),
  };

  function resetInvoiceForm() {
    setEditingInvoice(null);
    setInvoiceForm({
      contactId: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      notes: '',
      status: 'pending',
      post: false,
      lines: [makeInvoiceLine()],
    });
  }

  function openNewInvoiceDialog() {
    resetInvoiceForm();
    setInvoiceDialogOpen(true);
  }

  function openEditInvoiceDialog(invoice: Invoice) {
    const matchedContact = contacts.find((contact) => (
      contact.name.toLowerCase() === invoice.customer_name.toLowerCase()
      || (invoice.customer_phone && contact.phone === invoice.customer_phone)
    ));
    setEditingInvoice(invoice);
    setInvoiceForm({
      contactId: matchedContact?.id ?? '',
      issueDate: invoice.created_at ? new Date(invoice.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      dueDate: invoice.due_date || '',
      notes: invoice.notes ?? '',
      status: invoice.status === 'draft' ? 'draft' : 'pending',
      post: false,
      lines: invoice.items.length
        ? invoice.items.map((item) => ({
          id: crypto.randomUUID(),
          itemId: '',
          description: item.name,
          quantity: String(item.quantity || 1),
          unitPrice: String(item.unit_price || item.total || ''),
          discountAmount: item.discount_amount ? String(item.discount_amount) : '',
          taxRateId: item.tax_rate_id ?? '',
          taxAmount: item.tax_amount ? String(item.tax_amount) : '',
          revenueAccountId: item.revenue_account_id ?? incomeAccounts.find((account) => account.systemKey === 'sales_revenue')?.id ?? '',
        }))
        : [makeInvoiceLine()],
    });
    setSelectedInvoice(null);
    setInvoiceDialogOpen(true);
  }

  function updateInvoiceLine(id: string, patch: Partial<InvoiceFormLine>) {
    setInvoiceForm((current) => ({
      ...current,
      lines: current.lines.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (patch.itemId !== undefined) {
          const item = accountingItems.find((candidate) => candidate.id === patch.itemId);
          if (item) {
            next.description = item.name;
            next.unitPrice = String(item.defaultPrice || '');
            next.taxRateId = item.taxRateId ?? next.taxRateId;
            next.revenueAccountId = item.salesAccountId ?? next.revenueAccountId;
          }
        }
        return next;
      }),
    }));
  }

  function removeInvoiceLine(id: string) {
    setInvoiceForm((current) => ({
      ...current,
      lines: current.lines.length === 1 ? current.lines : current.lines.filter((line) => line.id !== id),
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Manage all invoices, templates, and payment tracking">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button onClick={openNewInvoiceDialog}>
            <Plus className="w-4 h-4 mr-2" /> New Invoice
          </Button>
          <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Template
          </Button>
        </div>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
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

      <InvoiceListTabs
        invoices={invoices}
        filtered={filtered}
        templates={templates}
        isLoading={isLoading}
        search={search}
        statusFilter={statusFilter}
        postInvoicePending={postInvoiceMutation.isPending}
        whatsappPending={whatsappOutboxMutation.isPending}
        pdfPending={pdfMutation.isPending}
        setSearch={setSearch}
        setStatusFilter={setStatusFilter}
        formatDate={formatDate}
        invoiceCanBeEdited={invoiceCanBeEdited}
        isPartialStatus={isPartialStatus}
        isPastDue={isPastDue}
        onSelectInvoice={setSelectedInvoice}
        onRecordPayment={(invoice, amount = '') => {
          setSelectedInvoice(invoice);
          setPaymentAmount(amount);
          setPaymentDialogOpen(true);
        }}
        onEditInvoice={openEditInvoiceDialog}
        onPostInvoice={(invoiceId) => postInvoiceMutation.mutate(invoiceId)}
        onQueueWhatsApp={(invoice) => whatsappOutboxMutation.mutate(invoice)}
        onDownloadPdf={(invoiceId) => pdfMutation.mutate(invoiceId)}
        onOpenTemplateDialog={() => setTemplateDialogOpen(true)}
        onOpenWhatsAppReminder={openWhatsApp}
      />

      {/* View Invoice Dialog */}
      {selectedInvoice && !paymentDialogOpen && !creditDialogOpen && !invoiceDialogOpen && (
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{selectedInvoice.invoice_number}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-medium ${STATUS_CONFIG[selectedInvoice.status].className}`}>
                  {STATUS_CONFIG[selectedInvoice.status].label}
                </span>
              </DialogTitle>
              <DialogDescription>
                Review invoice totals, ledger posting status, payment actions, and credit-note options.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Customer:</span><p className="font-medium">{selectedInvoice.customer_name}</p></div>
                <div><span className="text-muted-foreground">Phone:</span><p className="font-medium">{selectedInvoice.customer_phone ?? '—'}</p></div>
                <div><span className="text-muted-foreground">Order:</span><p className="font-medium">{selectedInvoice.order_tracking_code ?? '—'}</p></div>
                <div><span className="text-muted-foreground">Due Date:</span><p className="font-medium">{formatDate(selectedInvoice.due_date)}</p></div>
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
                {isPartialStatus(selectedInvoice.status) && (
                  <>
                    <div className="flex justify-between text-green-600"><span>Amount Paid</span><span>KES {selectedInvoice.paid_amount.toLocaleString()}</span></div>
                    <div className="flex justify-between text-red-600 font-semibold"><span>Balance Due</span><span>KES {selectedInvoice.balance.toLocaleString()}</span></div>
                  </>
                )}
                {selectedInvoice.posted_journal_entry_id && (
                  <div className="flex justify-between text-blue-600"><span>Ledger</span><span>Posted</span></div>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              {!selectedInvoice.posted_journal_entry_id && selectedInvoice.status !== 'draft' && selectedInvoice.status !== 'cancelled' && (
                <Button
                  variant="outline"
                  disabled={postInvoiceMutation.isPending}
                  onClick={() => postInvoiceMutation.mutate(selectedInvoice.id)}
                >
                  Post to Ledger
                </Button>
              )}
              <Button variant="outline" onClick={() => { setPaymentAmount(''); setPaymentDialogOpen(true); }}>
                <Edit2 className="h-4 w-4 mr-2" /> Update Payment
              </Button>
              {invoiceCanBeEdited(selectedInvoice) && (
                <Button variant="outline" onClick={() => openEditInvoiceDialog(selectedInvoice)}>
                  Edit Invoice
                </Button>
              )}
              {selectedInvoice.balance > 0 && selectedInvoice.status !== 'cancelled' && (
                <Button variant="outline" onClick={() => { setCreditAmount(String(selectedInvoice.balance)); setCreditDialogOpen(true); }}>
                  Credit Note
                </Button>
              )}
              {selectedInvoice.customer_phone && (
                <Button
                  variant="outline"
                  disabled={whatsappOutboxMutation.isPending}
                  onClick={() => whatsappOutboxMutation.mutate(selectedInvoice)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" /> Queue WhatsApp
                </Button>
              )}
              <Button disabled={pdfMutation.isPending} onClick={() => pdfMutation.mutate(selectedInvoice.id)}>
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Invoice Editor Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={(open) => {
        setInvoiceDialogOpen(open);
        if (!open) resetInvoiceForm();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? `Edit Invoice — ${editingInvoice.invoice_number}` : 'New Invoice'}</DialogTitle>
            <DialogDescription>
              Create invoices from accounting contacts and canonical invoice lines. Posted or paid invoices are adjusted with payments, credit notes, and reversals.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice-contact">Customer *</Label>
                <Select value={invoiceForm.contactId} onValueChange={(value) => setInvoiceForm((current) => ({ ...current, contactId: value }))}>
                  <SelectTrigger id="invoice-contact"><SelectValue placeholder={customerContacts.length ? 'Select customer' : 'Create a customer contact first'} /></SelectTrigger>
                  <SelectContent>
                    {customerContacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>{contact.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="invoice-status">Status *</Label>
                <Select value={invoiceForm.status} onValueChange={(value) => setInvoiceForm((current) => ({ ...current, status: value as typeof invoiceForm.status }))}>
                  <SelectTrigger id="invoice-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Issued / Pending</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="invoice-issue-date">Issue Date *</Label>
                <Input
                  id="invoice-issue-date"
                  name="invoice-issue-date"
                  type="date"
                  value={invoiceForm.issueDate}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, issueDate: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="invoice-due-date">Due Date</Label>
                <Input
                  id="invoice-due-date"
                  name="invoice-due-date"
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Invoice Lines</p>
                  <p className="text-xs text-muted-foreground">Use accounting items when possible; descriptions are snapshotted onto the invoice.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoiceForm((current) => ({ ...current, lines: [...current.lines, makeInvoiceLine()] }))}
                >
                  <Plus className="h-4 w-4 mr-1" /> Line
                </Button>
              </div>

              <div className="space-y-3">
                {invoiceForm.lines.map((line, index) => {
                  const calculated = calculateInvoiceLine(line, taxRates);
                  return (
                    <div key={line.id} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">Line {index + 1}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={invoiceForm.lines.length === 1}
                          onClick={() => removeInvoiceLine(line.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div>
                          <Label>Item</Label>
                          <Select value={line.itemId || 'none'} onValueChange={(value) => updateInvoiceLine(line.id, { itemId: value === 'none' ? '' : value })}>
                            <SelectTrigger><SelectValue placeholder="Optional item" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Custom line</SelectItem>
                              {accountingItems.map((item) => (
                                <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="lg:col-span-2">
                          <Label htmlFor={`invoice-line-description-${line.id}`}>Description *</Label>
                          <Input
                            id={`invoice-line-description-${line.id}`}
                            name={`invoice-line-description-${line.id}`}
                            value={line.description}
                            onChange={(event) => updateInvoiceLine(line.id, { description: event.target.value })}
                            placeholder="Service or product description"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                        <div>
                          <Label htmlFor={`invoice-line-quantity-${line.id}`}>Qty *</Label>
                          <Input
                            id={`invoice-line-quantity-${line.id}`}
                            name={`invoice-line-quantity-${line.id}`}
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={line.quantity}
                            onChange={(event) => updateInvoiceLine(line.id, { quantity: event.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`invoice-line-price-${line.id}`}>Unit Price *</Label>
                          <Input
                            id={`invoice-line-price-${line.id}`}
                            name={`invoice-line-price-${line.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(event) => updateInvoiceLine(line.id, { unitPrice: event.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`invoice-line-discount-${line.id}`}>Discount</Label>
                          <Input
                            id={`invoice-line-discount-${line.id}`}
                            name={`invoice-line-discount-${line.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.discountAmount}
                            onChange={(event) => updateInvoiceLine(line.id, { discountAmount: event.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Tax</Label>
                          <Select value={line.taxRateId || 'none'} onValueChange={(value) => updateInvoiceLine(line.id, { taxRateId: value === 'none' ? '' : value, taxAmount: '' })}>
                            <SelectTrigger><SelectValue placeholder="No tax" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No tax</SelectItem>
                              {taxRates.map((taxRate) => (
                                <SelectItem key={taxRate.id} value={taxRate.id}>{taxRate.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`invoice-line-tax-amount-${line.id}`}>Tax Amount</Label>
                          <Input
                            id={`invoice-line-tax-amount-${line.id}`}
                            name={`invoice-line-tax-amount-${line.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.taxAmount}
                            onChange={(event) => updateInvoiceLine(line.id, { taxAmount: event.target.value })}
                            placeholder={String(calculated.taxAmount)}
                          />
                        </div>
                        <div>
                          <Label>Total</Label>
                          <div className="h-10 rounded-md border bg-muted px-3 py-2 text-sm font-medium">
                            KES {calculated.total.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label>Revenue Account</Label>
                        <Select value={line.revenueAccountId || 'none'} onValueChange={(value) => updateInvoiceLine(line.id, { revenueAccountId: value === 'none' ? '' : value })}>
                          <SelectTrigger><SelectValue placeholder="Default sales revenue" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Default sales revenue</SelectItem>
                            {incomeAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>{account.code} · {account.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="invoice-notes">Notes</Label>
              <Textarea
                id="invoice-notes"
                name="invoice-notes"
                value={invoiceForm.notes}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))}
                rows={2}
                placeholder="Payment terms, scope notes, or internal context"
              />
            </div>

            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>KES {invoiceTotals.subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span>VAT / Tax</span><span>KES {invoiceTotals.tax.toLocaleString()}</span></div>
              <Separator />
              <div className="flex justify-between font-semibold"><span>Total</span><span>KES {invoiceTotals.total.toLocaleString()}</span></div>
              <label className="flex items-center gap-2 pt-2 text-sm">
                <input
                  type="checkbox"
                  checked={invoiceForm.post}
                  disabled={invoiceForm.status === 'draft'}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, post: event.target.checked }))}
                />
                Post to ledger immediately
              </label>
              {invoiceForm.status === 'draft' && (
                <p className="text-xs text-muted-foreground">Draft invoices stay editable and are not posted to the ledger.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={invoiceMutation.isPending}
              onClick={() => {
                if (!invoiceForm.contactId) {
                  toast.error('Customer is required');
                  return;
                }
                if (invoiceTotals.total <= 0) {
                  toast.error('Invoice total must be greater than zero');
                  return;
                }
                invoiceMutation.mutate();
              }}
            >
              {invoiceMutation.isPending ? 'Saving...' : editingInvoice ? 'Update Invoice' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Update Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={(open) => {
        setPaymentDialogOpen(open);
        if (!open) {
          setPaymentAmount('');
          setPaymentMethod('mpesa');
          setPaymentReference('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment — {selectedInvoice?.invoice_number}</DialogTitle>
            <DialogDescription>Record a new payment against this invoice. The invoice balance and status update together.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-muted text-center"><p className="text-muted-foreground text-xs">Invoice Total</p><p className="font-bold">KES {selectedInvoice?.total.toLocaleString()}</p></div>
              <div className="p-3 rounded-lg bg-muted text-center"><p className="text-muted-foreground text-xs">Previously Paid</p><p className="font-bold">KES {selectedInvoice?.paid_amount.toLocaleString()}</p></div>
              <div className="p-3 rounded-lg bg-muted text-center"><p className="text-muted-foreground text-xs">Balance</p><p className="font-bold">KES {selectedInvoice?.balance.toLocaleString()}</p></div>
            </div>
            <div>
              <Label htmlFor="invoice-payment-amount">New Payment Amount (KES) *</Label>
              <Input
                id="invoice-payment-amount"
                name="invoice-payment-amount"
                type="number"
                min="1"
                step="0.01"
                max={selectedInvoice?.balance}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter this payment amount"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This records a payment event. To mark paid, enter the current balance.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Method *</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger aria-label="Payment method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="invoice-payment-reference">Reference</Label>
                <Input
                  id="invoice-payment-reference"
                  name="invoice-payment-reference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Receipt / transaction ref"
                />
              </div>
            </div>
            {paymentAmount && selectedInvoice && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                {parseFloat(paymentAmount) >= selectedInvoice.balance
                  ? <p className="text-green-600 font-medium">Will be marked as paid after recording.</p>
                  : parseFloat(paymentAmount) > 0
                    ? <p className="text-blue-600 font-medium">Balance remaining: KES {(selectedInvoice.balance - parseFloat(paymentAmount)).toLocaleString()}.</p>
                    : <p className="text-muted-foreground">Enter a positive payment amount.</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={paymentMutation.isPending || !paymentAmount}
              onClick={() => {
                if (!selectedInvoice) return;
                const amount = parseFloat(paymentAmount);
                if (!Number.isFinite(amount) || amount <= 0) {
                  toast.error('Payment amount must be greater than zero');
                  return;
                }
                if (amount > selectedInvoice.balance) {
                  toast.error('Payment amount cannot exceed the invoice balance');
                  return;
                }
                paymentMutation.mutate({
                  invoiceId: selectedInvoice.id,
                  amount,
                  method: paymentMethod,
                  reference: paymentReference,
                  recordedBy: user?.id,
                });
              }}
            >
              {paymentMutation.isPending ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Note Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={(open) => {
        setCreditDialogOpen(open);
        if (!open) {
          setCreditAmount('');
          setCreditReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Credit Note — {selectedInvoice?.invoice_number}</DialogTitle>
            <DialogDescription>Reduce this invoice balance with an auditable credit note and reversal-style ledger posting.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Invoice Balance</p>
                <p className="font-semibold">KES {selectedInvoice?.balance.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-semibold">{selectedInvoice?.customer_name}</p>
              </div>
            </div>
            <div>
              <Label htmlFor="invoice-credit-amount">Credit Amount (KES) *</Label>
              <Input
                id="invoice-credit-amount"
                name="invoice-credit-amount"
                type="number"
                min="1"
                step="0.01"
                max={selectedInvoice?.balance}
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invoice-credit-reason">Reason *</Label>
              <Textarea
                id="invoice-credit-reason"
                name="invoice-credit-reason"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                rows={3}
                placeholder="e.g. Service adjustment, pricing correction, customer credit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={creditNoteMutation.isPending || !selectedInvoice}
              onClick={() => {
                if (!selectedInvoice) return;
                const amount = parseFloat(creditAmount);
                if (!Number.isFinite(amount) || amount <= 0 || amount > selectedInvoice.balance) {
                  toast.error('Credit amount must be within the invoice balance');
                  return;
                }
                if (!creditReason.trim()) {
                  toast.error('Credit reason is required');
                  return;
                }
                creditNoteMutation.mutate({
                  invoiceId: selectedInvoice.id,
                  amount,
                  reason: creditReason,
                });
              }}
            >
              {creditNoteMutation.isPending ? 'Saving...' : 'Create Credit Note'}
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
