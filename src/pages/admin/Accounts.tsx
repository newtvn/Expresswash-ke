import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle, Plus, Download,
  FileText, Users, GitCommitHorizontal, ChevronDown,
  RotateCcw, Trash2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { useAuthStore } from '@/stores/authStore';
import { useBusinessStore, BUSINESS_ALL } from '@/stores/businessStore';
import { toBusinessParam } from '@/types/business';
import { AccountsReportsPanel } from '@/components/admin/accounts/AccountsReportsPanel';
import { LedgerJournalEntries } from '@/components/admin/accounts/LedgerJournalEntries';
import { BusinessSwitcher } from '@/components/admin/accounts/BusinessSwitcher';
import {
  getLedgerCashFlow,
  getLedgerBalanceSheet,
  getLedgerProfitAndLoss,
  getPayablesAging,
  getReceivablesAging,
  getVatSummary,
} from '@/services/accounting/reports';
import { listNotificationOutbox, replayNotificationOutbox } from '@/services/accounting/outbox';
import {
  allocateCustomerPayment,
  createSupplierBill,
  getAccountingSetup,
  getCustomerPaymentAllocationOptions,
  getLedgerOverview,
  getOperationalAccounting,
  postBalancedJournalEntry,
  postExpenseLedgerEntry,
  postInvoiceLedgerEntry,
  postPaymentReceivedLedgerEntry,
  recordSupplierBillPayment,
  recordCustomerRefund,
  reversePostedJournalEntry,
  saveAccountingContact,
} from '@/services/accounting/application';
import type { Bill, ChartAccount, Contact, JournalEntry, NotificationOutboxItem } from '@/types/accounting';

type DateRange = { from: Date | undefined; to: Date | undefined };
type ExpenseCategory = 'fuel' | 'supplies' | 'salary' | 'rent' | 'utilities' | 'marketing' | 'maintenance' | 'other';
type ExpensePaymentMethod = 'cash' | 'mpesa' | 'bank_transfer' | 'card';

interface AccountPayment {
  id: string;
  invoice_id?: string;
  amount: number | string;
  status: string;
  created_at: string;
  method?: string;
  customer_name?: string;
  recorded_by?: string;
  provider?: string;
  provider_status?: string;
  phone_number?: string;
  payer_phone_number?: string;
  payer_phone_matches_intent?: boolean | null;
  merchant_request_id?: string;
  checkout_request_id?: string;
  mpesa_receipt_number?: string;
  result_desc?: string;
  unapplied_amount?: number | string;
  posted_journal_entry_id?: string;
}

interface AccountExpense {
  id: string;
  amount: number | string;
  category: ExpenseCategory;
  description: string;
  expense_date: string;
  payment_method: ExpensePaymentMethod;
  status: string;
  posted_journal_entry_id?: string;
}

interface AgingInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  total: number | string;
  paid_amount: number | string;
  balance?: number | string;
  due_date?: string;
  due_at?: string;
  status: string;
  created_at: string;
  posted_journal_entry_id?: string;
}

interface AccountOrder {
  total: number | string;
  status: number;
  created_at: string;
  customer_name?: string;
}

interface PaymentStatusEvent {
  id: string;
  payment_id: string;
  from_status?: string | null;
  to_status: string;
  trigger_source?: string | null;
  changed_by?: string | null;
  created_at: string;
}

interface SalesByItemRow {
  name: string;
  quantity: number;
  total: number;
}

type BillFormLine = {
  id: string;
  description: string;
  amount: string;
  taxAmount: string;
  expenseAccountId: string;
};

type AllocationFormRow = {
  id: string;
  invoiceId: string;
  amount: string;
};

const toAmount = (value: unknown): number => {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const formatDate = (value?: string | null): string => {
  if (!value) return 'No date';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const getInvoiceDueDate = (invoice: AgingInvoice): string | undefined => invoice.due_date ?? invoice.due_at;

const STATUS_EVENT_LABELS: Record<string, string> = {
  initial_insert: 'Payment record created',
  status_update: 'Payment status changed',
  provider_callback: 'Provider callback received',
  manual_update: 'Manual admin update',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  created: 'Created',
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  reversed: 'Reversed',
};

const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
  pesapal: 'PesaPal',
  legacy_mpesa: 'Legacy M-Pesa',
  manual: 'Manual',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mpesa: 'M-Pesa',
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
};

const humanizeCode = (value?: string | null): string => {
  if (!value) return 'Event';
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatPaymentStatus = (value?: string | null): string => {
  if (!value) return 'Created';
  return PAYMENT_STATUS_LABELS[value] ?? humanizeCode(value);
};

const formatPaymentProvider = (value?: string | null): string => {
  if (!value) return 'Manual';
  return PAYMENT_PROVIDER_LABELS[value] ?? humanizeCode(value);
};

const formatPaymentMethod = (value?: string | null): string => {
  if (!value) return 'M-Pesa';
  return PAYMENT_METHOD_LABELS[value] ?? humanizeCode(value);
};

const formatStatusTrigger = (value?: string | null): string => {
  if (!value) return 'Payment event';
  return STATUS_EVENT_LABELS[value] ?? humanizeCode(value);
};

// ---------- Service helpers ----------

async function fetchAccountSummary() {
  const [ordersRes, paymentsRes, expensesRes] = await Promise.all([
    supabase.from('orders').select('total, status, created_at, customer_name'),
    supabase.from('payments').select('id, amount, status, created_at, method, customer_name, recorded_by, provider, provider_status, payer_phone_matches_intent, unapplied_amount, posted_journal_entry_id'),
    supabase.from('expenses').select('id, amount, category, expense_date, payment_method, status, description'),
  ]);

  const orders = (ordersRes.data ?? []) as AccountOrder[];
  const payments = (paymentsRes.data ?? []) as AccountPayment[];
  const expenses = (expensesRes.data ?? []) as AccountExpense[];

  const totalRevenue = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + toAmount(p.amount), 0);
  const totalExpenses = expenses.filter((e) => e.status !== 'rejected').reduce((s, e) => s + toAmount(e.amount), 0);
  const totalReceivable = orders
    .filter((o) => o.status !== 13 && o.status !== 14)
    .reduce((s, o) => s + toAmount(o.total), 0);
  const outstanding = totalReceivable - totalRevenue;

  return { totalRevenue, totalExpenses, outstanding, netProfit: totalRevenue - totalExpenses, payments, expenses, orders };
}

async function fetchExpenses(business?: string) {
  const biz = toBusinessParam(business);
  let q = supabase.from('expenses').select('*').order('expense_date', { ascending: false });
  if (biz) q = q.eq('business', biz);
  const { data } = await q;
  return (data ?? []) as AccountExpense[];
}

async function fetchPaymentsReceived(from?: string, to?: string, business?: string) {
  const biz = toBusinessParam(business);
  let q = supabase
    .from('payments')
    .select('id, invoice_id, amount, status, created_at, method, customer_name, recorded_by, provider, provider_status, phone_number, payer_phone_number, payer_phone_matches_intent, merchant_request_id, checkout_request_id, mpesa_receipt_number, result_desc, unapplied_amount, posted_journal_entry_id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });
  if (biz) q = q.eq('business', biz);
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to + 'T23:59:59');
  const { data } = await q;
  return (data ?? []) as AccountPayment[];
}

async function fetchPaymentEvents(paymentId: string): Promise<PaymentStatusEvent[]> {
  const { data, error } = await supabase
    .from('payment_status_events')
    .select('id, payment_id, from_status, to_status, trigger_source, changed_by, created_at')
    .eq('payment_id', paymentId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PaymentStatusEvent[];
}

async function fetchSalesByItem(): Promise<SalesByItemRow[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('name, quantity, total_price')
    .limit(500);
  if (error) throw new Error(error.message);

  const grouped = (data ?? []).reduce<Record<string, SalesByItemRow>>((acc, item) => {
    const name = String(item.name ?? 'Item');
    const current = acc[name] ?? { name, quantity: 0, total: 0 };
    current.quantity += toAmount(item.quantity || 1);
    current.total += toAmount(item.total_price);
    acc[name] = current;
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => (b.total || b.quantity) - (a.total || a.quantity))
    .slice(0, 10);
}

async function fetchAgingSummary(business?: string) {
  const biz = toBusinessParam(business);
  let q = supabase
    .from('invoices')
    .select('id, invoice_number, customer_name, total, paid_amount, balance, due_date, due_at, status, created_at, posted_journal_entry_id')
    .neq('status', 'paid');
  if (biz) q = q.eq('business', biz);
  const { data } = await q;
  return (data ?? []) as AgingInvoice[];
}

async function addExpense(payload: {
  description: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  payment_method: ExpensePaymentMethod;
  created_by: string;
  business?: string;
}) {
  const { error } = await supabase.from('expenses').insert(payload);
  if (error) throw new Error(error.message);
}

async function addJournalEntry(payload: {
  debitAccountId: string; creditAccountId: string; amount: number; description: string; date: string; businessId?: string;
}) {
  const result = await postBalancedJournalEntry({
    sourceType: 'manual_adjustment',
    entryDate: payload.date,
    memo: payload.description,
    businessId: payload.businessId,
    lines: [
      { accountId: payload.debitAccountId, debit: payload.amount, description: payload.description },
      { accountId: payload.creditAccountId, credit: payload.amount, description: payload.description },
    ],
  });

  if (!result.success) {
    throw new Error(result.errors.join(', ') || 'Failed to post journal entry');
  }
}

const EXPENSE_CATEGORIES: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'fuel', label: 'Fuel' },
  { value: 'supplies', label: 'Cleaning Supplies' },
  { value: 'salary', label: 'Salary' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_METHODS: Array<{ value: ExpensePaymentMethod; label: string }> = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
];

const makeBillLine = (): BillFormLine => ({
  id: crypto.randomUUID(),
  description: '',
  amount: '',
  taxAmount: '',
  expenseAccountId: '',
});

const makeAllocationRow = (): AllocationFormRow => ({
  id: crypto.randomUUID(),
  invoiceId: '',
  amount: '',
});

// ---------- Component ----------

export const Accounts = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [addJournalOpen, setAddJournalOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addBillOpen, setAddBillOpen] = useState(false);
  const [billPaymentTarget, setBillPaymentTarget] = useState<Bill | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<AccountPayment | null>(null);
  const [refundTarget, setRefundTarget] = useState<AccountPayment | null>(null);
  const [allocationTarget, setAllocationTarget] = useState<AccountPayment | null>(null);
  const [contactForm, setContactForm] = useState<{
    name: string;
    contactType: Contact['contactType'];
    phone: string;
    email: string;
    taxPin: string;
  }>({
    name: '',
    contactType: 'supplier',
    phone: '',
    email: '',
    taxPin: '',
  });
  const [billForm, setBillForm] = useState({
    supplierContactId: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    lines: [makeBillLine()],
  });
  const [billPaymentForm, setBillPaymentForm] = useState({
    amount: '',
    method: 'bank_transfer' as ExpensePaymentMethod,
    reference: '',
  });
  const [refundForm, setRefundForm] = useState({
    amount: '',
    method: 'mpesa' as ExpensePaymentMethod,
    reference: '',
    reason: '',
  });
  const [allocationRows, setAllocationRows] = useState<AllocationFormRow[]>([makeAllocationRow()]);
  const [expenseForm, setExpenseForm] = useState<{
    description: string;
    category: ExpenseCategory | '';
    amount: string;
    expense_date: string;
    payment_method: ExpensePaymentMethod;
    notes: string;
  }>({
    description: '',
    category: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'mpesa',
    notes: '',
  });
  const [journalForm, setJournalForm] = useState({
    debitAccountId: '',
    creditAccountId: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Business scope for reports/overview/operational lists (super_admin can switch).
  // Non-super-admins are Expresswash-only: never honor a persisted cross-business scope
  // (e.g. left over from a super_admin session on this browser) — force expresswash so a
  // regular admin can't send an unauthorized scope that the backend would reject.
  const rawSelectedBusiness = useBusinessStore((s) => s.selectedBusiness);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  const selectedBusiness = isSuperAdmin ? rawSelectedBusiness : 'expresswash';
  // Consolidated view spans all businesses, so writes (which need one concrete business) are disabled.
  const isConsolidated = selectedBusiness === BUSINESS_ALL;
  const consolidatedWriteHint = 'Select a specific business to create records';

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['accounts', 'summary'],
    queryFn: fetchAccountSummary,
    refetchInterval: 60000,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['accounts', 'expenses', selectedBusiness],
    queryFn: () => fetchExpenses(selectedBusiness),
  });

  const { data: paymentsReceived = [] } = useQuery({
    queryKey: ['accounts', 'payments', selectedBusiness, dateRange.from?.toISOString().split('T')[0], dateRange.to?.toISOString().split('T')[0]],
    queryFn: () => fetchPaymentsReceived(
      dateRange.from?.toISOString().split('T')[0],
      dateRange.to?.toISOString().split('T')[0],
      selectedBusiness,
    ),
  });

  const { data: agingData = [] } = useQuery({
    queryKey: ['accounts', 'aging', selectedBusiness],
    queryFn: () => fetchAgingSummary(selectedBusiness),
  });

  const reportFrom = dateRange.from?.toISOString().split('T')[0];
  const reportTo = dateRange.to?.toISOString().split('T')[0];

  const { data: accountingSetup } = useQuery({
    queryKey: ['accounting', 'setup'],
    queryFn: getAccountingSetup,
  });

  const chartAccounts = accountingSetup?.accounts ?? [];
  const contacts = accountingSetup?.contacts ?? [];
  const suppliers = contacts.filter((contact) => contact.contactType === 'supplier' || contact.contactType === 'both');

  const { data: ledgerOverview } = useQuery({
    queryKey: ['accounting', 'ledger-overview', selectedBusiness],
    queryFn: () => getLedgerOverview(selectedBusiness),
  });

  const { data: operationalAccounting } = useQuery({
    queryKey: ['accounting', 'operational', selectedBusiness],
    queryFn: () => getOperationalAccounting(selectedBusiness),
  });

  const bills = operationalAccounting?.bills ?? [];
  const refunds = operationalAccounting?.refunds ?? [];
  const customerCredits = operationalAccounting?.customerCredits ?? [];
  const refundableAmount = refundTarget
    ? Math.max(
      toAmount(refundTarget.amount) - refunds
        .filter((refund) => refund.status !== 'void' && refund.paymentId === refundTarget.id)
        .reduce((sum, refund) => sum + toAmount(refund.amount), 0),
      0,
    )
    : 0;
  const billTotal = billForm.lines.reduce((sum, line) => sum + toAmount(line.amount) + toAmount(line.taxAmount), 0);

  const { data: profitAndLoss } = useQuery({
    queryKey: ['accounting', 'reports', 'profit-loss', selectedBusiness, reportFrom, reportTo],
    queryFn: () => getLedgerProfitAndLoss(reportFrom, reportTo, selectedBusiness),
  });

  const { data: balanceSheet } = useQuery({
    queryKey: ['accounting', 'reports', 'balance-sheet', selectedBusiness, reportTo],
    queryFn: () => getLedgerBalanceSheet(reportTo, selectedBusiness),
  });

  const { data: vatSummary } = useQuery({
    queryKey: ['accounting', 'reports', 'vat', selectedBusiness, reportFrom, reportTo],
    queryFn: () => getVatSummary(reportFrom, reportTo, selectedBusiness),
  });

  const { data: cashFlow } = useQuery({
    queryKey: ['accounting', 'reports', 'cash-flow', selectedBusiness, reportFrom, reportTo],
    queryFn: () => getLedgerCashFlow(reportFrom, reportTo, selectedBusiness),
  });

  const { data: receivablesAging } = useQuery({
    queryKey: ['accounting', 'reports', 'receivables-aging', selectedBusiness, reportTo],
    queryFn: () => getReceivablesAging(reportTo, selectedBusiness),
  });

  const { data: payablesAging } = useQuery({
    queryKey: ['accounting', 'reports', 'payables-aging', selectedBusiness, reportTo],
    queryFn: () => getPayablesAging(reportTo, selectedBusiness),
  });

  // KPI cards mirror the (business-scoped) ledger reports so they stay consistent with the
  // report cards below and re-scope with the switcher. Outstanding = total receivables.
  const arOutstanding = receivablesAging
    ? receivablesAging.current + receivablesAging.days1To30 + receivablesAging.days31To60
      + receivablesAging.days61To90 + receivablesAging.days90Plus
    : 0;

  const { data: selectedPaymentEvents = [], isLoading: selectedPaymentEventsLoading } = useQuery({
    queryKey: ['payments', selectedPayment?.id, 'events'],
    queryFn: () => fetchPaymentEvents(selectedPayment!.id),
    enabled: Boolean(selectedPayment?.id),
  });

  const { data: allocationOptions, isLoading: allocationOptionsLoading } = useQuery({
    queryKey: ['payments', allocationTarget?.id, 'allocation-options'],
    queryFn: () => getCustomerPaymentAllocationOptions(allocationTarget!.id),
    enabled: Boolean(allocationTarget?.id),
  });

  const { data: salesByItem = [] } = useQuery({
    queryKey: ['accounts', 'sales-by-item'],
    queryFn: fetchSalesByItem,
  });

  const { data: notificationOutbox = [] } = useQuery({
    queryKey: ['accounting', 'notification-outbox'],
    queryFn: () => listNotificationOutbox(),
  });

  const addExpenseMutation = useMutation({
    mutationFn: addExpense,
    onSuccess: () => {
      toast.success('Expense added — pending approval');
      setAddExpenseOpen(false);
      setExpenseForm({
        description: '',
        category: '',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: 'mpesa',
        notes: '',
      });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addJournalMutation = useMutation({
    mutationFn: addJournalEntry,
    onSuccess: () => {
      toast.success('Journal entry added');
      setAddJournalOpen(false);
      setJournalForm({
        debitAccountId: '',
        creditAccountId: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['accounting'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reverseJournalMutation = useMutation({
    mutationFn: (entry: JournalEntry) => reversePostedJournalEntry(
      entry.id,
      new Date().toISOString().split('T')[0],
      `Reversal for ${entry.entryNumber}`,
    ),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to reverse journal entry');
        return;
      }
      toast.success('Journal entry reversed');
      qc.invalidateQueries({ queryKey: ['accounting'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveContactMutation = useMutation({
    mutationFn: saveAccountingContact,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save contact');
        return;
      }
      toast.success('Contact saved');
      setAddContactOpen(false);
      setContactForm({ name: '', contactType: 'supplier', phone: '', email: '', taxPin: '' });
      qc.invalidateQueries({ queryKey: ['accounting', 'setup'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createBillMutation = useMutation({
    mutationFn: createSupplierBill,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to create bill');
        return;
      }
      toast.success(`Bill ${result.billNumber ?? ''} created`);
      setAddBillOpen(false);
      setBillForm({
        supplierContactId: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        notes: '',
        lines: [makeBillLine()],
      });
      qc.invalidateQueries({ queryKey: ['accounting'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const billPaymentMutation = useMutation({
    mutationFn: recordSupplierBillPayment,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to record bill payment');
        return;
      }
      toast.success('Bill payment recorded');
      setBillPaymentTarget(null);
      setBillPaymentForm({ amount: '', method: 'bank_transfer', reference: '' });
      qc.invalidateQueries({ queryKey: ['accounting'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refundMutation = useMutation({
    mutationFn: recordCustomerRefund,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to record refund');
        return;
      }
      toast.success(`Refund ${result.refundNumber ?? ''} recorded`);
      setRefundTarget(null);
      setRefundForm({ amount: '', method: 'mpesa', reference: '', reason: '' });
      qc.invalidateQueries({ queryKey: ['accounting'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allocationMutation = useMutation({
    mutationFn: allocateCustomerPayment,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to allocate payment');
        return;
      }
      toast.success('Payment allocated');
      setAllocationTarget(null);
      setAllocationRows([makeAllocationRow()]);
      qc.invalidateQueries({ queryKey: ['accounting'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
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
      toast.success(result.idempotent ? 'Invoice already posted' : 'Invoice posted');
      qc.invalidateQueries({ queryKey: ['accounting'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const postPaymentMutation = useMutation({
    mutationFn: postPaymentReceivedLedgerEntry,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to post payment');
        return;
      }
      toast.success(result.idempotent ? 'Payment already posted' : 'Payment posted');
      qc.invalidateQueries({ queryKey: ['accounting'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const postExpenseMutation = useMutation({
    mutationFn: postExpenseLedgerEntry,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to post expense');
        return;
      }
      toast.success(result.idempotent ? 'Expense already posted' : 'Expense posted');
      qc.invalidateQueries({ queryKey: ['accounting'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replayOutboxMutation = useMutation({
    mutationFn: replayNotificationOutbox,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? 'Failed to replay notification');
        return;
      }
      toast.success('Notification queued for replay');
      qc.invalidateQueries({ queryKey: ['accounting', 'notification-outbox'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!allocationTarget || !allocationOptions) return;
    setAllocationRows(
      allocationOptions.allocations.length > 0
        ? allocationOptions.allocations.map((allocation) => ({
          id: crypto.randomUUID(),
          invoiceId: allocation.invoiceId,
          amount: String(allocation.amountAllocated),
        }))
        : [makeAllocationRow()],
    );
  }, [allocationOptions, allocationTarget]);

  // Aging buckets
  const now = new Date();
  const getDaysOverdue = (invoice: AgingInvoice) => {
    const dueDate = getInvoiceDueDate(invoice);
    if (!dueDate) return 0;
    const parsed = new Date(dueDate);
    if (Number.isNaN(parsed.getTime())) return 0;
    return Math.floor((now.getTime() - parsed.getTime()) / 86400000);
  };

  const agingBuckets = {
    current: agingData.filter((i) => {
      const days = getDaysOverdue(i);
      return days <= 0;
    }),
    '1_30': agingData.filter((i) => {
      const d = getDaysOverdue(i);
      return d > 0 && d <= 30;
    }),
    '31_60': agingData.filter((i) => {
      const d = getDaysOverdue(i);
      return d > 30 && d <= 60;
    }),
    '61_90': agingData.filter((i) => {
      const d = getDaysOverdue(i);
      return d > 60 && d <= 90;
    }),
    over_90: agingData.filter((i) => {
      const d = getDaysOverdue(i);
      return d > 90;
    }),
  };

  // Sales by person chart data (from payments)
  const salesByPerson = (summary?.payments ?? [])
    .filter((p) => p.status === 'completed' && p.recorded_by)
    .reduce((acc: Record<string, number>, p) => {
      const key = p.recorded_by ?? 'Unknown';
      acc[key] = (acc[key] ?? 0) + toAmount(p.amount);
      return acc;
    }, {});

  const salesByPersonData = Object.entries(salesByPerson).map(([name, total]) => ({ name, total }));
  const expenseAccounts = chartAccounts.filter((account) => account.accountType === 'expense');
  const openUnpostedInvoices = agingData.filter((invoice) => (
    invoice.status !== 'draft'
    && invoice.status !== 'cancelled'
    && !invoice.posted_journal_entry_id
    && toAmount(invoice.total) > 0
  ));
  const unpostedPayments = paymentsReceived.filter((payment) => !payment.posted_journal_entry_id && toAmount(payment.amount) > 0);
  const unpostedExpenses = expenses.filter((expense) => expense.status !== 'rejected' && !expense.posted_journal_entry_id && toAmount(expense.amount) > 0);

  const formatCurrency = (value: number | undefined) => `KES ${(value ?? 0).toLocaleString()}`;
  const formatAccount = (account: ChartAccount) => `${account.code} · ${account.name}`;
  const canReplayOutbox = (item: NotificationOutboxItem) => item.status === 'failed' || item.status === 'dead_letter';
  const reportRangeLabel = reportFrom || reportTo
    ? `${reportFrom ?? 'Start'} to ${reportTo ?? 'Today'}`
    : 'All time';

  const updateBillLine = (id: string, patch: Partial<BillFormLine>) => {
    setBillForm((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  };

  const removeBillLine = (id: string) => {
    setBillForm((current) => ({
      ...current,
      lines: current.lines.length === 1 ? current.lines : current.lines.filter((line) => line.id !== id),
    }));
  };

  const updateAllocationRow = (id: string, patch: Partial<AllocationFormRow>) => {
    setAllocationRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeAllocationRow = (id: string) => {
    setAllocationRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  };

  const allocationInvoiceOptions = allocationOptions?.openInvoices ?? [];
  const allocationRowsTotal = allocationRows.reduce((sum, row) => sum + toAmount(row.amount), 0);
  const allocationRemaining = allocationOptions
    ? Math.max(allocationOptions.payment.amount - allocationRowsTotal, 0)
    : Math.max(toAmount(allocationTarget?.amount) - allocationRowsTotal, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts" description="Financial overview, reports, and expense management">
        <div className="flex flex-wrap items-center gap-2">
          <BusinessSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Create <ChevronDown className="w-4 h-4 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => setAddContactOpen(true)}>
                <Users className="w-4 h-4 mr-2" /> New contact
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={isConsolidated} onSelect={() => setAddBillOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> New bill
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isConsolidated} onSelect={() => setAddExpenseOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> New expense
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isConsolidated} onSelect={() => setAddJournalOpen(true)}>
                <FileText className="w-4 h-4 mr-2" /> New journal entry
              </DropdownMenuItem>
              {isConsolidated && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">{consolidatedWriteHint}</p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PageHeader>

      {/* KPI Summary */}
      <p className="-mb-3 text-xs text-muted-foreground">Ledger totals · {reportRangeLabel}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: profitAndLoss?.totalIncome ?? 0, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Expenses', value: profitAndLoss?.totalExpenses ?? 0, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Net Profit', value: profitAndLoss?.netProfit ?? 0, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Outstanding', value: arOutstanding, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="py-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${kpi.bg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-bold">KES {(kpi.value).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="reports">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto" aria-label="Accounting sections">
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="expenses" className="ml-2 border-l pl-4">Purchases & Expenses</TabsTrigger>
          <TabsTrigger value="payments">Payments Received</TabsTrigger>
          <TabsTrigger value="aging">Aging Summary</TabsTrigger>
          <TabsTrigger value="payables" className="ml-2 border-l pl-4">Payables & Bills</TabsTrigger>
          <TabsTrigger value="refunds">Credits & Refunds</TabsTrigger>
          <TabsTrigger value="posting" className="ml-2 border-l pl-4">Posting Gaps</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="outbox">Outbox</TabsTrigger>
        </TabsList>

        {/* ---- REPORTS ---- */}
        <TabsContent value="reports">
          <AccountsReportsPanel
            dateRange={dateRange}
            reportRangeLabel={reportRangeLabel}
            orders={summary?.orders ?? []}
            salesByPersonData={salesByPersonData}
            salesByItem={salesByItem}
            showOperationalSales={selectedBusiness === 'expresswash'}
            profitAndLoss={profitAndLoss}
            balanceSheet={balanceSheet}
            vatSummary={vatSummary}
            cashFlow={cashFlow}
            setDateRange={setDateRange}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        {/* ---- LEDGER ---- */}
        <TabsContent value="ledger" className="mt-4">
          <LedgerJournalEntries
            entries={ledgerOverview?.entries ?? []}
            reversePending={reverseJournalMutation.isPending}
            writesDisabled={isConsolidated}
            formatDate={formatDate}
            onReverseJournalEntry={(entry) => reverseJournalMutation.mutate(entry)}
          />
        </TabsContent>

        {/* ---- EXPENSES ---- */}
        <TabsContent value="expenses" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Purchases & Expenses</CardTitle>
              <Button size="sm" disabled={isConsolidated} title={isConsolidated ? consolidatedWriteHint : undefined} onClick={() => setAddExpenseOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No expenses recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {expenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{e.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {humanizeCode(e.category)} · {formatDate(e.expense_date)} · {formatPaymentMethod(e.payment_method)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {e.status && e.status !== 'approved' && (
                          <Badge variant={e.status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">{e.status}</Badge>
                        )}
                        <span className={`font-semibold ${e.status === 'rejected' ? 'text-muted-foreground line-through' : 'text-red-600'}`}>
                          {formatCurrency(toAmount(e.amount))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- PAYMENTS RECEIVED ---- */}
        <TabsContent value="payments" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            <Button
              variant="outline"
              size="sm"
              disabled={paymentsReceived.length === 0}
              onClick={() => downloadCsv(
                `payments-${selectedBusiness}-${new Date().toISOString().split('T')[0]}.csv`,
                ['Date', 'Customer', 'Amount', 'Method', 'Reference', 'Status'],
                paymentsReceived.map((p) => [
                  formatDate(p.created_at),
                  p.customer_name ?? '',
                  toAmount(p.amount),
                  p.method ?? '',
                  p.mpesa_receipt_number ?? p.checkout_request_id ?? '',
                  p.status ?? '',
                ]),
              )}
            >
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          </div>
          <Card>
            <CardContent className="pt-4">
              {paymentsReceived.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No payments received in this period. Adjust the date range, or record a payment from an invoice.</p>
              ) : (
                <div className="space-y-2">
                  {paymentsReceived.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{p.customer_name ?? 'Customer'}</p>
                          {p.provider && <Badge variant="outline" className="text-xs">{formatPaymentProvider(p.provider)}</Badge>}
                          {toAmount(p.unapplied_amount) > 0 && <Badge variant="secondary" className="text-xs">Credit {formatCurrency(toAmount(p.unapplied_amount))}</Badge>}
                          {p.posted_journal_entry_id && <Badge variant="outline" className="text-xs">Posted</Badge>}
                          {p.payer_phone_matches_intent === false && <Badge variant="destructive" className="text-xs">Phone mismatch</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatPaymentMethod(p.method)} · {formatDate(p.created_at)}
                          {p.provider_status ? ` · ${formatPaymentStatus(p.provider_status)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-green-600">KES {toAmount(p.amount).toLocaleString()}</p>
                          {toAmount(p.unapplied_amount) > 0 && <p className="text-xs text-muted-foreground">Unapplied {formatCurrency(toAmount(p.unapplied_amount))}</p>}
                        </div>
                        {toAmount(p.unapplied_amount) > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isConsolidated}
                            title={isConsolidated ? consolidatedWriteHint : undefined}
                            onClick={() => {
                              setAllocationTarget(p);
                              setAllocationRows([makeAllocationRow()]);
                            }}
                          >
                            Allocate
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setSelectedPayment(p)}>
                          <GitCommitHorizontal className="h-3 w-3 mr-1" /> View trail
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 border-t font-semibold">
                    <span>Total Received</span>
                    <span className="text-green-600">KES {paymentsReceived.reduce((s, p) => s + toAmount(p.amount), 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- AGING SUMMARY ---- */}
        <TabsContent value="aging" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="aging-asof" className="text-sm text-muted-foreground">As of</Label>
            <Input
              id="aging-asof"
              type="date"
              className="w-44"
              value={reportTo ?? ''}
              onChange={(e) => setDateRange({ from: dateRange.from, to: e.target.value ? new Date(e.target.value) : undefined })}
            />
          </div>

          <p className="text-xs text-muted-foreground">Receivables outstanding by age, as of {reportTo ?? 'today'}.</p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Current', amount: receivablesAging?.current ?? agingBuckets.current.reduce((s, i) => s + toAmount(i.balance ?? Math.max(toAmount(i.total) - toAmount(i.paid_amount), 0)), 0), color: 'text-green-600' },
              { label: '1–30 days', amount: receivablesAging?.days1To30 ?? agingBuckets['1_30'].reduce((s, i) => s + toAmount(i.balance ?? Math.max(toAmount(i.total) - toAmount(i.paid_amount), 0)), 0), color: 'text-yellow-600' },
              { label: '31–60 days', amount: receivablesAging?.days31To60 ?? agingBuckets['31_60'].reduce((s, i) => s + toAmount(i.balance ?? Math.max(toAmount(i.total) - toAmount(i.paid_amount), 0)), 0), color: 'text-orange-600' },
              { label: '61–90 days', amount: receivablesAging?.days61To90 ?? agingBuckets['61_90'].reduce((s, i) => s + toAmount(i.balance ?? Math.max(toAmount(i.total) - toAmount(i.paid_amount), 0)), 0), color: 'text-red-500' },
              { label: '90+ days', amount: receivablesAging?.days90Plus ?? agingBuckets.over_90.reduce((s, i) => s + toAmount(i.balance ?? Math.max(toAmount(i.total) - toAmount(i.paid_amount), 0)), 0), color: 'text-red-700' },
            ].map((bucket) => (
              <Card key={bucket.label}>
                <CardContent className="py-4 text-center">
                  <p className="text-xs text-muted-foreground">{bucket.label}</p>
                  <p className={`text-2xl font-bold ${bucket.color}`}>{formatCurrency(bucket.amount)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Open Invoices</CardTitle></CardHeader>
            <CardContent>
              {(receivablesAging?.items.length ?? 0) === 0 && agingData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No open invoices — all receivables are settled.</p>
              ) : (receivablesAging?.items.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  {receivablesAging!.items.map((inv) => (
                    <div key={inv.invoiceId ?? inv.invoiceNumber} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{inv.invoiceNumber} — {inv.customerName ?? 'Customer'}</p>
                        <p className="text-xs text-muted-foreground">Due: {formatDate(inv.dueDate)} · {Math.max(0, inv.daysOverdue)} days overdue</p>
                      </div>
                      <span className="font-semibold text-red-600">{formatCurrency(inv.balanceDue)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {agingData.map((inv) => {
                    const dueDate = getInvoiceDueDate(inv);
                    const daysOverdue = Math.max(0, getDaysOverdue(inv));
                    const balance = toAmount(inv.balance ?? Math.max(toAmount(inv.total) - toAmount(inv.paid_amount), 0));
                    return (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">{inv.invoice_number} — {inv.customer_name}</p>
                          <p className="text-xs text-muted-foreground">Due: {formatDate(dueDate)} · {daysOverdue} days overdue</p>
                        </div>
                        <span className="font-semibold text-red-600">KES {balance.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- PAYABLES & BILLS ---- */}
        <TabsContent value="payables" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Bills & Payables</CardTitle>
              <Button size="sm" disabled={isConsolidated} title={isConsolidated ? consolidatedWriteHint : undefined} onClick={() => setAddBillOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Bill
              </Button>
            </CardHeader>
            <CardContent>
              {bills.length > 0 ? (
                <div className="space-y-2">
                  {bills.map((bill) => (
                    <div key={bill.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{bill.billNumber} — {bill.supplierName ?? 'Supplier'}</p>
                          <Badge variant={bill.status === 'paid' ? 'default' : bill.status === 'void' ? 'destructive' : 'outline'}>
                            {humanizeCode(bill.status)}
                          </Badge>
                          {bill.postedJournalEntryId && <Badge variant="outline">Posted</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Issued: {formatDate(bill.issueDate)} · Due: {formatDate(bill.dueDate)} · Paid: {formatCurrency(bill.amountPaid)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(bill.total)}</p>
                          <p className="text-xs text-muted-foreground">Balance {formatCurrency(bill.balanceDue)}</p>
                        </div>
                        {bill.status !== 'paid' && bill.status !== 'void' && bill.balanceDue > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isConsolidated}
                            title={isConsolidated ? consolidatedWriteHint : undefined}
                            onClick={() => {
                              setBillPaymentTarget(bill);
                              setBillPaymentForm({ amount: String(bill.balanceDue), method: 'bank_transfer', reference: '' });
                            }}
                          >
                            Pay
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-sm">
                    <div><p className="text-muted-foreground">Current</p><p className="font-semibold">{formatCurrency(payablesAging?.current)}</p></div>
                    <div><p className="text-muted-foreground">1-30</p><p className="font-semibold">{formatCurrency(payablesAging?.days1To30)}</p></div>
                    <div><p className="text-muted-foreground">31-60</p><p className="font-semibold">{formatCurrency(payablesAging?.days31To60)}</p></div>
                    <div><p className="text-muted-foreground">61-90</p><p className="font-semibold">{formatCurrency(payablesAging?.days61To90)}</p></div>
                    <div><p className="text-muted-foreground">90+</p><p className="font-semibold">{formatCurrency(payablesAging?.days90Plus)}</p></div>
                  </div>
                </div>
              ) : (payablesAging?.items.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  {payablesAging!.items.map((bill) => (
                    <div key={bill.billId ?? bill.billNumber} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{bill.billNumber} — {bill.supplierName ?? 'Supplier'}</p>
                        <p className="text-xs text-muted-foreground">Due: {formatDate(bill.dueDate)} · {Math.max(0, bill.daysOverdue)} days overdue</p>
                      </div>
                      <span className="font-semibold">{formatCurrency(bill.balanceDue)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No bills yet. Add a supplier contact, then create a bill to track what you owe.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- CREDITS & REFUNDS ---- */}
        <TabsContent value="refunds" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Credits & Refunds</CardTitle>
            </CardHeader>
            <CardContent>
              {customerCredits.length === 0 && refunds.length === 0 && (operationalAccounting?.creditNotes.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No customer credits, credit notes, or refunds recorded yet</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Customer Credit Balances</p>
                    {customerCredits.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No unapplied customer payments</p>
                    ) : (
                      <div className="space-y-2">
                        {customerCredits.map((credit) => (
                          <div key={credit.paymentId} className="rounded-lg border p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold">{credit.customerName ?? 'Customer'}</p>
                                  {credit.provider && <Badge variant="outline">{formatPaymentProvider(credit.provider)}</Badge>}
                                  {credit.postedJournalEntryId && <Badge variant="outline">Posted</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Received {formatDate(credit.createdAt)} · Total {formatCurrency(credit.amount)} · Allocated {formatCurrency(credit.allocatedAmount)}
                                </p>
                                {credit.providerReference && <p className="text-xs text-muted-foreground">Reference: {credit.providerReference}</p>}
                              </div>
                              <div className="flex items-center gap-3 sm:justify-end">
                                <div className="text-right">
                                  <p className="font-semibold">{formatCurrency(credit.unappliedAmount)}</p>
                                  <p className="text-xs text-muted-foreground">Available</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isConsolidated}
                                  title={isConsolidated ? consolidatedWriteHint : undefined}
                                  onClick={() => {
                                    const payment = paymentsReceived.find((item) => item.id === credit.paymentId);
                                    setAllocationTarget(payment ?? {
                                      id: credit.paymentId,
                                      amount: credit.amount,
                                      status: 'completed',
                                      created_at: credit.createdAt,
                                      method: credit.method,
                                      customer_name: credit.customerName,
                                      provider: credit.provider,
                                      unapplied_amount: credit.unappliedAmount,
                                      posted_journal_entry_id: credit.postedJournalEntryId,
                                    });
                                    setAllocationRows([makeAllocationRow()]);
                                  }}
                                >
                                  Apply
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium mb-2">Credit Notes</p>
                    {(operationalAccounting?.creditNotes.length ?? 0) === 0 ? (
                      <p className="text-xs text-muted-foreground">No credit notes yet</p>
                    ) : (
                      <div className="space-y-2">
                        {operationalAccounting!.creditNotes.map((credit) => (
                          <div key={credit.id} className="rounded-lg border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">{credit.creditNoteNumber}</p>
                                <p className="text-xs text-muted-foreground">
                                  {credit.contactName ?? 'Customer'} · {formatDate(credit.issueDate)} · {humanizeCode(credit.status)}
                                </p>
                                {credit.reason && <p className="text-xs mt-1">{credit.reason}</p>}
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{formatCurrency(credit.total)}</p>
                                {credit.postedJournalEntryId && <Badge variant="outline">Posted</Badge>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium mb-2">Refunds</p>
                    {refunds.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No refunds yet</p>
                    ) : (
                      <div className="space-y-2">
                        {refunds.map((refund) => (
                          <div key={refund.id} className="rounded-lg border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">{refund.refundNumber}</p>
                                <p className="text-xs text-muted-foreground">
                                  {refund.contactName ?? 'Customer'} · {formatDate(refund.createdAt)} · {formatPaymentMethod(refund.method)}
                                </p>
                                {refund.reference && <p className="text-xs text-muted-foreground">Reference: {refund.reference}</p>}
                                {refund.reason && <p className="text-xs mt-1">{refund.reason}</p>}
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-red-600">{formatCurrency(refund.amount)}</p>
                                {refund.postedJournalEntryId && <Badge variant="outline">Posted</Badge>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- POSTING GAPS ---- */}
        <TabsContent value="posting" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Unposted Invoices</CardTitle></CardHeader>
              <CardContent>
                {openUnpostedInvoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No invoice posting gaps</p>
                ) : (
                  <div className="space-y-2">
                    {openUnpostedInvoices.map((invoice) => (
                      <div key={invoice.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{invoice.invoice_number}</p>
                            <p className="text-xs text-muted-foreground">
                              {invoice.customer_name} · {formatDate(invoice.created_at)} · {formatCurrency(toAmount(invoice.total))}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isConsolidated || (postInvoiceMutation.isPending && postInvoiceMutation.variables === invoice.id)}
                            title={isConsolidated ? consolidatedWriteHint : undefined}
                            onClick={() => postInvoiceMutation.mutate(invoice.id)}
                          >
                            {postInvoiceMutation.isPending && postInvoiceMutation.variables === invoice.id ? 'Posting…' : 'Post'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Unposted Payments</CardTitle></CardHeader>
              <CardContent>
                {unpostedPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No payment posting gaps</p>
                ) : (
                  <div className="space-y-2">
                    {unpostedPayments.map((payment) => (
                      <div key={payment.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{payment.customer_name ?? 'Customer'}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(payment.created_at)} · {formatCurrency(toAmount(payment.amount))}
                              {toAmount(payment.unapplied_amount) > 0 ? ` · Credit ${formatCurrency(toAmount(payment.unapplied_amount))}` : ''}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isConsolidated || (postPaymentMutation.isPending && postPaymentMutation.variables === payment.id)}
                            title={isConsolidated ? consolidatedWriteHint : undefined}
                            onClick={() => postPaymentMutation.mutate(payment.id)}
                          >
                            {postPaymentMutation.isPending && postPaymentMutation.variables === payment.id ? 'Posting…' : 'Post'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Unposted Expenses</CardTitle></CardHeader>
              <CardContent>
                {unpostedExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No expense posting gaps</p>
                ) : (
                  <div className="space-y-2">
                    {unpostedExpenses.map((expense) => (
                      <div key={expense.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{expense.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {humanizeCode(expense.category)} · {formatDate(expense.expense_date)} · {formatCurrency(toAmount(expense.amount))}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isConsolidated || (postExpenseMutation.isPending && postExpenseMutation.variables === expense.id)}
                            title={isConsolidated ? consolidatedWriteHint : undefined}
                            onClick={() => postExpenseMutation.mutate(expense.id)}
                          >
                            {postExpenseMutation.isPending && postExpenseMutation.variables === expense.id ? 'Posting…' : 'Post'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- CONTACTS ---- */}
        <TabsContent value="contacts" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Customers & Suppliers</CardTitle>
              <Button size="sm" onClick={() => setAddContactOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Contact
              </Button>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No contacts recorded yet</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{contact.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {humanizeCode(contact.contactType)} · {contact.phone || contact.email || 'No contact detail'}
                          </p>
                          {contact.taxPin && <p className="text-xs text-muted-foreground">Tax PIN: {contact.taxPin}</p>}
                        </div>
                        <Badge variant="outline">{humanizeCode(contact.source)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- OUTBOX ---- */}
        <TabsContent value="outbox" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Outbox</CardTitle>
            </CardHeader>
            <CardContent>
              {notificationOutbox.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No queued notifications yet</p>
              ) : (
                <div className="space-y-2">
                  {notificationOutbox.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{humanizeCode(item.eventType)}</p>
                            <Badge variant={item.status === 'dead_letter' || item.status === 'failed' ? 'destructive' : 'outline'}>
                              {humanizeCode(item.status)}
                            </Badge>
                            <Badge variant="outline">{humanizeCode(item.channel)}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.recipientName || item.recipientContact} · {humanizeCode(item.aggregateType)}
                            {item.aggregateId ? ` · ${item.aggregateId.slice(0, 8)}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Attempts {item.attemptCount}/{item.maxAttempts} · Available {formatDate(item.availableAt)}
                          </p>
                          {item.lastError && (
                            <p className="text-xs text-destructive break-words">Last error: {item.lastError}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canReplayOutbox(item) || replayOutboxMutation.isPending}
                          title={!canReplayOutbox(item) ? 'Only failed or dead-letter notifications can be replayed' : undefined}
                          onClick={() => replayOutboxMutation.mutate(item.id)}
                        >
                          Replay
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Contact Dialog */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Create a customer, supplier, or shared contact for accounting workflows.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact-name">Name *</Label>
                <Input id="contact-name" required value={contactForm.name} onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))} placeholder="Supplier or customer name" />
              </div>
              <div>
                <Label htmlFor="contact-type">Type *</Label>
                <Select value={contactForm.contactType} onValueChange={(v) => setContactForm((p) => ({ ...p, contactType: v as Contact['contactType'] }))}>
                  <SelectTrigger id="contact-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact-phone">Phone</Label>
                <Input id="contact-phone" value={contactForm.phone} onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+254..." />
              </div>
              <div>
                <Label htmlFor="contact-email">Email</Label>
                <Input id="contact-email" type="email" value={contactForm.email} onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))} placeholder="name@example.com" />
              </div>
            </div>
            <div>
              <Label htmlFor="contact-taxpin">Tax PIN / VAT Number</Label>
              <Input id="contact-taxpin" value={contactForm.taxPin} onChange={(e) => setContactForm((p) => ({ ...p, taxPin: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddContactOpen(false)}>Cancel</Button>
            <Button
              disabled={saveContactMutation.isPending}
              onClick={() => saveContactMutation.mutate({
                name: contactForm.name,
                contactType: contactForm.contactType,
                phone: contactForm.phone || undefined,
                email: contactForm.email || undefined,
                taxPin: contactForm.taxPin || undefined,
                source: 'admin',
                active: true,
              })}
            >
              {saveContactMutation.isPending ? 'Saving...' : 'Save Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Bill Dialog */}
      <Dialog open={addBillOpen} onOpenChange={setAddBillOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Supplier Bill</DialogTitle>
            <DialogDescription>Create an open payable and post it to the ledger.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bill-supplier">Supplier *</Label>
                <Select value={billForm.supplierContactId} onValueChange={(v) => setBillForm((p) => ({ ...p, supplierContactId: v }))}>
                  <SelectTrigger id="bill-supplier"><SelectValue placeholder={suppliers.length ? 'Select supplier' : 'Create a supplier first'} /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Bill Lines</p>
                  <p className="text-xs text-muted-foreground">Split supplier bills by expense account for cleaner reporting.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setBillForm((current) => ({ ...current, lines: [...current.lines, makeBillLine()] }))}
                >
                  <Plus className="h-4 w-4 mr-1" /> Line
                </Button>
              </div>
              {billForm.lines.map((line, index) => (
                <div key={line.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Line {index + 1}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Remove line"
                      title="Remove line"
                      disabled={billForm.lines.length === 1}
                      onClick={() => removeBillLine(line.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <Label>Description *</Label>
                    <Input value={line.description} onChange={(e) => updateBillLine(line.id, { description: e.target.value })} placeholder="e.g. Cleaning supplies invoice" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label>Amount before VAT (KES) *</Label>
                      <Input type="number" min="0" step="0.01" value={line.amount} onChange={(e) => updateBillLine(line.id, { amount: e.target.value })} placeholder="0" />
                    </div>
                    <div>
                      <Label>Input VAT (KES)</Label>
                      <Input type="number" min="0" step="0.01" value={line.taxAmount} onChange={(e) => updateBillLine(line.id, { taxAmount: e.target.value })} placeholder="0" />
                    </div>
                    <div>
                      <Label>Total</Label>
                      <div className="h-10 rounded-md border bg-muted px-3 py-2 text-sm font-medium">
                        {formatCurrency(toAmount(line.amount) + toAmount(line.taxAmount))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Expense Account *</Label>
                    <Select value={line.expenseAccountId} onValueChange={(v) => updateBillLine(line.id, { expenseAccountId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select expense account" /></SelectTrigger>
                      <SelectContent>
                        {expenseAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>{formatAccount(account)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Issue Date *</Label>
                <Input type="date" value={billForm.issueDate} onChange={(e) => setBillForm((p) => ({ ...p, issueDate: e.target.value }))} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={billForm.dueDate} onChange={(e) => setBillForm((p) => ({ ...p, dueDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={billForm.notes} onChange={(e) => setBillForm((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Optional supplier/bill notes" />
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="flex justify-between"><span>Bill total</span><span className="font-semibold">{formatCurrency(billTotal)}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">This posts Dr expense, Dr input VAT if provided, and Cr accounts payable.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBillOpen(false)}>Cancel</Button>
            <Button
              disabled={createBillMutation.isPending}
              onClick={() => {
                const invalidLine = billForm.lines.find((line) => !line.description.trim() || !line.expenseAccountId || toAmount(line.amount) <= 0);
                if (!billForm.supplierContactId || invalidLine || billTotal <= 0) {
                  toast.error('Supplier and valid bill lines are required');
                  return;
                }
                createBillMutation.mutate({
                  supplierContactId: billForm.supplierContactId,
                  issueDate: billForm.issueDate,
                  dueDate: billForm.dueDate || undefined,
                  notes: billForm.notes || undefined,
                  post: true,
                  businessId: toBusinessParam(selectedBusiness) ?? undefined,
                  lines: billForm.lines.map((line) => ({
                    description: line.description,
                    quantity: 1,
                    unitPrice: toAmount(line.amount),
                    taxAmount: toAmount(line.taxAmount),
                    expenseAccountId: line.expenseAccountId,
                  })),
                });
              }}
            >
              {createBillMutation.isPending ? 'Saving...' : 'Create Bill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bill Payment Dialog */}
      <Dialog open={!!billPaymentTarget} onOpenChange={(open) => {
        if (!open) {
          setBillPaymentTarget(null);
          setBillPaymentForm({ amount: '', method: 'bank_transfer', reference: '' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Bill Payment</DialogTitle>
            <DialogDescription>Pay this supplier bill and post the cash/accounts payable ledger movement.</DialogDescription>
          </DialogHeader>
          {billPaymentTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Bill</p>
                  <p className="font-semibold">{billPaymentTarget.billNumber}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="font-semibold">{formatCurrency(billPaymentTarget.balanceDue)}</p>
                </div>
              </div>
              <div>
                <Label htmlFor="billpay-amount">Amount (KES) *</Label>
                <Input id="billpay-amount" type="number" min="1" step="0.01" required max={billPaymentTarget.balanceDue} value={billPaymentForm.amount} onChange={(e) => setBillPaymentForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="billpay-method">Method *</Label>
                  <Select value={billPaymentForm.method} onValueChange={(v) => setBillPaymentForm((p) => ({ ...p, method: v as ExpensePaymentMethod }))}>
                    <SelectTrigger id="billpay-method"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="billpay-reference">Reference</Label>
                  <Input id="billpay-reference" value={billPaymentForm.reference} onChange={(e) => setBillPaymentForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Transaction reference" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillPaymentTarget(null)}>Cancel</Button>
            <Button
              disabled={billPaymentMutation.isPending || !billPaymentTarget}
              onClick={() => {
                if (!billPaymentTarget) return;
                const amount = toAmount(billPaymentForm.amount);
                if (amount <= 0 || amount > billPaymentTarget.balanceDue) {
                  toast.error('Enter a valid payment amount within the bill balance');
                  return;
                }
                billPaymentMutation.mutate({
                  billId: billPaymentTarget.id,
                  amount,
                  method: billPaymentForm.method,
                  reference: billPaymentForm.reference || undefined,
                });
              }}
            >
              {billPaymentMutation.isPending ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Record a new expense or bill manually</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expense-description">Description *</Label>
                <Input id="expense-description" required value={expenseForm.description} onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))} placeholder="e.g. Driver salary" />
              </div>
              <div>
                <Label htmlFor="expense-category">Category *</Label>
                <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm((p) => ({ ...p, category: v as ExpenseCategory }))}>
                  <SelectTrigger id="expense-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expense-amount">Amount (KES) *</Label>
                <Input id="expense-amount" type="number" min="0" step="0.01" required value={expenseForm.amount} onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label htmlFor="expense-date">Date *</Label>
                <Input id="expense-date" type="date" required value={expenseForm.expense_date} onChange={(e) => setExpenseForm((p) => ({ ...p, expense_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="expense-method">Payment Method *</Label>
              <Select value={expenseForm.payment_method} onValueChange={(v) => setExpenseForm((p) => ({ ...p, payment_method: v as ExpensePaymentMethod }))}>
                <SelectTrigger id="expense-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="expense-notes">Notes</Label>
              <Textarea id="expense-notes" value={expenseForm.notes} onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Optional notes..." />
              <p className="mt-1 text-xs text-muted-foreground">Notes are appended to the description until expenses have a dedicated notes field.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddExpenseOpen(false)}>Cancel</Button>
            <Button
              disabled={addExpenseMutation.isPending}
              onClick={() => {
                if (!expenseForm.description || !expenseForm.category || !expenseForm.amount || !user?.id) {
                  toast.error(user?.id ? 'Please fill all required fields' : 'You must be signed in to add an expense');
                  return;
                }
                addExpenseMutation.mutate({
                  description: expenseForm.notes ? `${expenseForm.description}\n\nNotes: ${expenseForm.notes}` : expenseForm.description,
                  category: expenseForm.category,
                  amount: parseFloat(expenseForm.amount),
                  expense_date: expenseForm.expense_date,
                  payment_method: expenseForm.payment_method,
                  created_by: user.id,
                  business: toBusinessParam(selectedBusiness) ?? undefined,
                });
              }}
            >
              {addExpenseMutation.isPending ? 'Saving...' : 'Save Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Journal Entry Dialog */}
      <Dialog open={addJournalOpen} onOpenChange={setAddJournalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Journal Entry</DialogTitle>
            <DialogDescription>Post a balanced double-entry adjustment to the accounting ledger</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="je-debit">Debit Account *</Label>
                <Select value={journalForm.debitAccountId} onValueChange={(v) => setJournalForm((p) => ({ ...p, debitAccountId: v }))}>
                  <SelectTrigger id="je-debit"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {chartAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>{formatAccount(account)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="je-credit">Credit Account *</Label>
                <Select value={journalForm.creditAccountId} onValueChange={(v) => setJournalForm((p) => ({ ...p, creditAccountId: v }))}>
                  <SelectTrigger id="je-credit"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {chartAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>{formatAccount(account)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="je-amount">Amount (KES) *</Label>
                <Input id="je-amount" type="number" min="0" step="0.01" required value={journalForm.amount} onChange={(e) => setJournalForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label htmlFor="je-date">Date *</Label>
                <Input id="je-date" type="date" required value={journalForm.date} onChange={(e) => setJournalForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="je-memo">Memo *</Label>
              <Input id="je-memo" required value={journalForm.description} onChange={(e) => setJournalForm((p) => ({ ...p, description: e.target.value }))} placeholder="Entry description" />
            </div>
            <p className="text-xs text-muted-foreground">
              The backend rejects unbalanced entries. This form posts one debit line and one matching credit line.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddJournalOpen(false)}>Cancel</Button>
            <Button
              disabled={addJournalMutation.isPending}
              onClick={() => {
                const amount = parseFloat(journalForm.amount) || 0;
                if (!journalForm.debitAccountId || !journalForm.creditAccountId || !journalForm.description || amount <= 0) {
                  toast.error('Debit account, credit account, memo, and amount are required');
                  return;
                }
                if (journalForm.debitAccountId === journalForm.creditAccountId) {
                  toast.error('Debit and credit accounts must be different');
                  return;
                }
                addJournalMutation.mutate({
                  debitAccountId: journalForm.debitAccountId,
                  creditAccountId: journalForm.creditAccountId,
                  amount,
                  description: journalForm.description,
                  date: journalForm.date,
                  businessId: toBusinessParam(selectedBusiness) ?? undefined,
                });
              }}
            >
              {addJournalMutation.isPending ? 'Saving...' : 'Save Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Trail</DialogTitle>
            <DialogDescription>
              Provider identifiers, receipt details, and immutable status events for this payment.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedPayment.customer_name ?? 'Customer'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-medium">{formatCurrency(toAmount(selectedPayment.amount))}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Provider Status</p>
                  <p className="font-medium">
                    {formatPaymentProvider(selectedPayment.provider)} · {formatPaymentStatus(selectedPayment.provider_status ?? selectedPayment.status)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Receipt</p>
                  <p className="font-medium">{selectedPayment.mpesa_receipt_number ?? '—'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Intent Phone</p>
                  <p className="font-medium">{selectedPayment.phone_number ?? '—'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Provider Payer Phone</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{selectedPayment.payer_phone_number ?? 'Not provided'}</p>
                    {selectedPayment.payer_phone_matches_intent === false && <Badge variant="destructive">Mismatch</Badge>}
                    {selectedPayment.payer_phone_matches_intent === true && <Badge variant="outline">Matched</Badge>}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium mb-2">Provider References</p>
                <div className="space-y-1 text-xs break-all">
                  <p><span className="text-muted-foreground">Merchant:</span> {selectedPayment.merchant_request_id ?? '—'}</p>
                  <p><span className="text-muted-foreground">Checkout / Tracking:</span> {selectedPayment.checkout_request_id ?? '—'}</p>
                  <p><span className="text-muted-foreground">Result:</span> {selectedPayment.result_desc ?? selectedPayment.status}</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="mr-2"
                  disabled={isConsolidated}
                  title={isConsolidated ? consolidatedWriteHint : undefined}
                  onClick={() => {
                    setAllocationTarget(selectedPayment);
                    setAllocationRows([makeAllocationRow()]);
                  }}
                >
                  Allocate
                </Button>
                <Button
                  variant="outline"
                  disabled={isConsolidated}
                  title={isConsolidated ? consolidatedWriteHint : undefined}
                  onClick={() => {
                    const alreadyRefunded = refunds
                      .filter((refund) => refund.status !== 'void' && refund.paymentId === selectedPayment.id)
                      .reduce((sum, refund) => sum + toAmount(refund.amount), 0);
                    const remainingRefundable = Math.max(toAmount(selectedPayment.amount) - alreadyRefunded, 0);
                    setRefundTarget(selectedPayment);
                    setRefundForm({
                      amount: remainingRefundable > 0 ? String(remainingRefundable) : '',
                      method: (selectedPayment.method as ExpensePaymentMethod) || 'mpesa',
                      reference: '',
                      reason: '',
                    });
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Record Refund
                </Button>
              </div>

              <div>
                <p className="font-medium mb-2">Status Timeline</p>
                {selectedPaymentEventsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading trail...</p>
                ) : selectedPaymentEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No status events recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedPaymentEvents.map((event) => (
                      <div key={event.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">
                            {formatPaymentStatus(event.from_status)} → {formatPaymentStatus(event.to_status)}
                          </p>
                          <Badge variant="outline">{formatStatusTrigger(event.trigger_source)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(event.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!refundTarget} onOpenChange={(open) => {
        if (!open) {
          setRefundTarget(null);
          setRefundForm({ amount: '', method: 'mpesa', reference: '', reason: '' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Customer Refund</DialogTitle>
            <DialogDescription>
              Record a cash/M-Pesa refund and post the reversal-style cash movement to the ledger.
            </DialogDescription>
          </DialogHeader>
          {refundTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-semibold">{refundTarget.customer_name ?? 'Customer'}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Original Payment</p>
                  <p className="font-semibold">{formatCurrency(toAmount(refundTarget.amount))}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Remaining Refundable</p>
                  <p className="font-semibold">{formatCurrency(refundableAmount)}</p>
                </div>
              </div>
              <div>
                <Label htmlFor="refund-amount">Refund Amount (KES) *</Label>
                <Input
                  id="refund-amount"
                  name="refund-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  max={refundableAmount}
                  value={refundForm.amount}
                  onChange={(event) => setRefundForm((current) => ({ ...current, amount: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Method *</Label>
                  <Select value={refundForm.method} onValueChange={(value) => setRefundForm((current) => ({ ...current, method: value as ExpensePaymentMethod }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="refund-reference">Reference</Label>
                  <Input
                    id="refund-reference"
                    name="refund-reference"
                    value={refundForm.reference}
                    onChange={(event) => setRefundForm((current) => ({ ...current, reference: event.target.value }))}
                    placeholder="Refund transaction ref"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="refund-reason">Reason</Label>
                <Textarea
                  id="refund-reason"
                  name="refund-reason"
                  value={refundForm.reason}
                  onChange={(event) => setRefundForm((current) => ({ ...current, reason: event.target.value }))}
                  rows={3}
                  placeholder="Why this refund was issued"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)}>Cancel</Button>
            <Button
              disabled={refundMutation.isPending || !refundTarget}
              onClick={() => {
                if (!refundTarget) return;
                const amount = toAmount(refundForm.amount);
                if (amount <= 0 || amount > refundableAmount) {
                  toast.error('Enter a valid refund amount within the remaining refundable amount');
                  return;
                }
                refundMutation.mutate({
                  invoiceId: refundTarget.invoice_id,
                  paymentId: refundTarget.id,
                  amount,
                  method: refundForm.method,
                  reference: refundForm.reference || undefined,
                  reason: refundForm.reason || undefined,
                });
              }}
            >
              {refundMutation.isPending ? 'Saving...' : 'Record Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!allocationTarget} onOpenChange={(open) => {
        if (!open) {
          setAllocationTarget(null);
          setAllocationRows([makeAllocationRow()]);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Allocate Payment</DialogTitle>
            <DialogDescription>
              Split one completed payment across open invoices for the same customer.
            </DialogDescription>
          </DialogHeader>
          {allocationTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Payment</p>
                  <p className="font-semibold">{formatCurrency(allocationOptions?.payment.amount ?? toAmount(allocationTarget.amount))}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Current Total</p>
                  <p className="font-semibold">{formatCurrency(allocationRowsTotal)}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Unapplied After Save</p>
                  <p className="font-semibold">{formatCurrency(allocationRemaining)}</p>
                </div>
              </div>
              {allocationOptionsLoading && <p className="text-sm text-muted-foreground">Loading allocation options...</p>}
              {!allocationOptionsLoading && allocationInvoiceOptions.length === 0 && (
                <p className="rounded-lg border p-3 text-sm text-muted-foreground">No open invoices are available for this customer.</p>
              )}
              <div className="space-y-3">
                {allocationRows.map((row, index) => (
                  <div key={row.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Allocation {index + 1}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label="Remove allocation"
                        title="Remove allocation"
                        disabled={allocationRows.length === 1}
                        onClick={() => removeAllocationRow(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Invoice *</Label>
                        <Select value={row.invoiceId} onValueChange={(value) => updateAllocationRow(row.id, { invoiceId: value })}>
                          <SelectTrigger><SelectValue placeholder="Select open invoice" /></SelectTrigger>
                          <SelectContent>
                            {allocationInvoiceOptions
                              .map((invoice) => (
                                <SelectItem key={invoice.invoiceId} value={invoice.invoiceId}>
                                  {invoice.invoiceNumber} · {invoice.customerName ?? 'Customer'} · {formatCurrency(invoice.balance + invoice.currentPaymentAllocation)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Amount (KES) *</Label>
                        <Input
                          type="number"
                          min="1"
                          step="0.01"
                          max={allocationInvoiceOptions.find((invoice) => invoice.invoiceId === row.invoiceId)
                            ? allocationInvoiceOptions.find((invoice) => invoice.invoiceId === row.invoiceId)!.balance
                              + allocationInvoiceOptions.find((invoice) => invoice.invoiceId === row.invoiceId)!.currentPaymentAllocation
                            : undefined}
                          value={row.amount}
                          onChange={(event) => updateAllocationRow(row.id, { amount: event.target.value })}
                        />
                        {row.invoiceId && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Available on invoice: {formatCurrency(
                              (() => {
                                const invoice = allocationInvoiceOptions.find((item) => item.invoiceId === row.invoiceId);
                                return invoice ? invoice.balance + invoice.currentPaymentAllocation : 0;
                              })(),
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAllocationRows((current) => [...current, makeAllocationRow()])}
                >
                  <Plus className="h-4 w-4 mr-1" /> Allocation
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocationTarget(null)}>Cancel</Button>
            <Button
              disabled={allocationMutation.isPending || !allocationTarget}
              onClick={() => {
                if (!allocationTarget) return;
                const totalAllocated = allocationRows.reduce((sum, row) => sum + toAmount(row.amount), 0);
                const paymentAmount = allocationOptions?.payment.amount ?? toAmount(allocationTarget.amount);
                if (totalAllocated <= 0 || totalAllocated > paymentAmount) {
                  toast.error('Allocation total must be greater than zero and within the payment amount');
                  return;
                }
                const hasInvalidRow = allocationRows.some((row) => !row.invoiceId || toAmount(row.amount) <= 0);
                if (hasInvalidRow) {
                  toast.error('Every allocation row needs an invoice and amount');
                  return;
                }
                const invoiceIds = allocationRows.map((row) => row.invoiceId);
                if (new Set(invoiceIds).size !== invoiceIds.length) {
                  toast.error('Each invoice can appear only once in an allocation');
                  return;
                }
                const exceedsInvoiceBalance = allocationRows.some((row) => {
                  const invoice = allocationInvoiceOptions.find((item) => item.invoiceId === row.invoiceId);
                  return !invoice || toAmount(row.amount) > invoice.balance + invoice.currentPaymentAllocation;
                });
                if (exceedsInvoiceBalance) {
                  toast.error('Allocation cannot exceed an invoice balance');
                  return;
                }
                allocationMutation.mutate({
                  paymentId: allocationTarget.id,
                  allocations: allocationRows.map((row) => ({
                    invoiceId: row.invoiceId,
                    amount: toAmount(row.amount),
                  })),
                });
              }}
            >
              {allocationMutation.isPending ? 'Saving...' : 'Allocate Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Accounts;
