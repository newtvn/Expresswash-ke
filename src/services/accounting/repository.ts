import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';
import { toBusinessParam } from '@/types/business';
import type {
  AccountBalance,
  AllocateCustomerPaymentInput,
  AccountingItem,
  AccountingOperationResult,
  Bill,
  ChartAccount,
  Contact,
  CreateBillInput,
  CreateCreditNoteInput,
  CreateInvoiceInput,
  CreditNote,
  CustomerCreditBalance,
  CustomerPaymentAllocationOptions,
  CustomerRefund,
  JournalEntry,
  JournalEntryInput,
  RecordCustomerRefundInput,
  RecordBillPaymentInput,
  TaxRate,
  UpdateInvoiceInput,
} from '@/types/accounting';

function mapContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    contactType: row.contact_type as Contact['contactType'],
    name: row.name as string,
    phone: (row.phone as string) ?? undefined,
    email: (row.email as string) ?? undefined,
    taxPin: (row.tax_pin as string) ?? undefined,
    appUserId: (row.app_user_id as string) ?? undefined,
    source: row.source as string,
    active: Boolean(row.active),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapAccount(row: Record<string, unknown>): ChartAccount {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    accountType: row.account_type as ChartAccount['accountType'],
    parentId: (row.parent_id as string) ?? undefined,
    normalBalance: row.normal_balance as ChartAccount['normalBalance'],
    description: (row.description as string) ?? undefined,
    systemKey: (row.system_key as string) ?? undefined,
    active: Boolean(row.active),
  };
}

function mapTaxRate(row: Record<string, unknown>): TaxRate {
  return {
    id: row.id as string,
    name: row.name as string,
    rate: Number(row.rate) || 0,
    taxType: row.tax_type as TaxRate['taxType'],
    isDefault: Boolean(row.is_default),
    active: Boolean(row.active),
  };
}

function mapAccountingItem(row: Record<string, unknown>): AccountingItem {
  return {
    id: row.id as string,
    name: row.name as string,
    itemType: row.item_type as AccountingItem['itemType'],
    defaultPrice: Number(row.default_price) || 0,
    salesAccountId: (row.sales_account_id as string) ?? undefined,
    expenseAccountId: (row.expense_account_id as string) ?? undefined,
    taxRateId: (row.tax_rate_id as string) ?? undefined,
    active: Boolean(row.active),
  };
}

function mapJournalEntry(row: Record<string, unknown>): JournalEntry {
  return {
    id: row.id as string,
    entryNumber: row.entry_number as string,
    sourceType: row.source_type as JournalEntry['sourceType'],
    sourceId: (row.source_id as string) ?? undefined,
    entryDate: row.entry_date as string,
    memo: (row.memo as string) ?? undefined,
    status: row.status as JournalEntry['status'],
    postedAt: (row.posted_at as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function mapAccountBalance(row: Record<string, unknown>): AccountBalance {
  return {
    accountId: row.account_id as string,
    code: row.code as string,
    name: row.name as string,
    accountType: row.account_type as AccountBalance['accountType'],
    normalBalance: row.normal_balance as AccountBalance['normalBalance'],
    totalDebit: Number(row.total_debit) || 0,
    totalCredit: Number(row.total_credit) || 0,
    balance: Number(row.balance) || 0,
  };
}

function mapOperationResult(data: unknown, fallback = 'Accounting operation failed'): AccountingOperationResult {
  const record = (data ?? {}) as Record<string, unknown>;
  return {
    success: record.success !== false,
    error: record.error ? String(record.error) : undefined,
    idempotent: record.idempotent as boolean | undefined,
    journalEntryId: (record.journal_entry_id as string) ?? undefined,
    invoiceId: (record.invoice_id as string) ?? undefined,
    invoiceNumber: (record.invoice_number as string) ?? undefined,
    paymentId: (record.payment_id as string) ?? undefined,
    billId: (record.bill_id as string) ?? undefined,
    billNumber: (record.bill_number as string) ?? undefined,
    paymentMadeId: (record.payment_made_id as string) ?? undefined,
    creditNoteId: (record.credit_note_id as string) ?? undefined,
    creditNoteNumber: (record.credit_note_number as string) ?? undefined,
    refundId: (record.refund_id as string) ?? undefined,
    refundNumber: (record.refund_number as string) ?? undefined,
    status: (record.status as string) ?? undefined,
    balance: record.balance === undefined ? undefined : Number(record.balance),
    balanceDue: record.balance_due === undefined ? undefined : Number(record.balance_due),
  } satisfies AccountingOperationResult;
}

const mapInvoiceLinesInput = (lines: CreateInvoiceInput['lines']) => lines.map((line) => ({
  item_id: line.itemId ?? null,
  description: line.description,
  quantity: line.quantity,
  unit_price: line.unitPrice,
  discount_amount: line.discountAmount ?? 0,
  tax_rate_id: line.taxRateId ?? null,
  tax_amount: line.taxAmount ?? null,
  revenue_account_id: line.revenueAccountId ?? null,
  metadata: line.metadata ?? {},
}));

function failedOperation(error: unknown, fallback = 'Accounting operation failed'): AccountingOperationResult {
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

function mapBill(row: Record<string, unknown>): Bill {
  const supplier = row.contacts as Record<string, unknown> | null | undefined;
  return {
    id: row.id as string,
    billNumber: row.bill_number as string,
    supplierContactId: (row.supplier_contact_id as string) ?? undefined,
    supplierName: (supplier?.name as string) ?? undefined,
    status: row.status as Bill['status'],
    issueDate: row.issue_date as string,
    dueDate: (row.due_date as string) ?? undefined,
    subtotal: Number(row.subtotal) || 0,
    taxTotal: Number(row.tax_total) || 0,
    discountTotal: Number(row.discount_total) || 0,
    total: Number(row.total) || 0,
    amountPaid: Number(row.amount_paid) || 0,
    balanceDue: Number(row.balance_due) || 0,
    currency: (row.currency as string) ?? 'KES',
    postedJournalEntryId: (row.posted_journal_entry_id as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function mapCreditNote(row: Record<string, unknown>): CreditNote {
  const contact = row.contacts as Record<string, unknown> | null | undefined;
  return {
    id: row.id as string,
    creditNoteNumber: row.credit_note_number as string,
    invoiceId: (row.invoice_id as string) ?? undefined,
    contactId: (row.contact_id as string) ?? undefined,
    contactName: (contact?.name as string) ?? undefined,
    status: row.status as CreditNote['status'],
    issueDate: row.issue_date as string,
    subtotal: Number(row.subtotal) || 0,
    taxTotal: Number(row.tax_total) || 0,
    total: Number(row.total) || 0,
    appliedAmount: Number(row.applied_amount) || 0,
    reason: (row.reason as string) ?? undefined,
    postedJournalEntryId: (row.posted_journal_entry_id as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function mapCustomerRefund(row: Record<string, unknown>): CustomerRefund {
  const contact = row.contacts as { name?: string } | undefined;
  return {
    id: row.id as string,
    refundNumber: row.refund_number as string,
    contactId: (row.contact_id as string) ?? undefined,
    contactName: contact?.name,
    invoiceId: (row.invoice_id as string) ?? undefined,
    paymentId: (row.payment_id as string) ?? undefined,
    amount: Number(row.amount) || 0,
    method: row.method as CustomerRefund['method'],
    reference: (row.reference as string) ?? undefined,
    reason: (row.reason as string) ?? undefined,
    status: row.status as CustomerRefund['status'],
    postedJournalEntryId: (row.posted_journal_entry_id as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function mapAllocationOptions(payload: Record<string, unknown>): CustomerPaymentAllocationOptions {
  const payment = (payload.payment ?? {}) as Record<string, unknown>;
  const allocations = (payload.allocations ?? []) as Record<string, unknown>[];
  const openInvoices = (payload.open_invoices ?? []) as Record<string, unknown>[];

  return {
    payment: {
      id: payment.id as string,
      amount: Number(payment.amount) || 0,
      allocatedAmount: Number(payment.allocated_amount) || 0,
      unappliedAmount: Number(payment.unapplied_amount) || 0,
      customerId: (payment.customer_id as string) ?? undefined,
      customerName: (payment.customer_name as string) ?? undefined,
      status: (payment.status as string) ?? 'completed',
      postedJournalEntryId: (payment.posted_journal_entry_id as string) ?? undefined,
    },
    allocations: allocations.map((allocation) => ({
      invoiceId: allocation.invoice_id as string,
      invoiceNumber: allocation.invoice_number as string,
      customerName: (allocation.customer_name as string) ?? undefined,
      amountAllocated: Number(allocation.amount_allocated) || 0,
      invoiceBalance: Number(allocation.invoice_balance) || 0,
      allocatedAt: (allocation.allocated_at as string) ?? undefined,
    })),
    openInvoices: openInvoices.map((invoice) => ({
      invoiceId: invoice.invoice_id as string,
      invoiceNumber: invoice.invoice_number as string,
      customerName: (invoice.customer_name as string) ?? undefined,
      total: Number(invoice.total) || 0,
      paidAmount: Number(invoice.paid_amount) || 0,
      balance: Number(invoice.balance) || 0,
      currentPaymentAllocation: Number(invoice.current_payment_allocation) || 0,
      dueDate: (invoice.due_date as string) ?? undefined,
      status: (invoice.status as string) ?? 'pending',
    })),
  };
}

function mapCustomerCreditBalance(row: Record<string, unknown>): CustomerCreditBalance {
  return {
    paymentId: row.payment_id as string,
    customerId: (row.customer_id as string) ?? undefined,
    customerName: (row.customer_name as string) ?? undefined,
    amount: Number(row.amount) || 0,
    allocatedAmount: Number(row.allocated_amount) || 0,
    unappliedAmount: Number(row.unapplied_amount) || 0,
    method: (row.method as string) ?? undefined,
    provider: (row.provider as string) ?? undefined,
    providerReference: (row.provider_reference as string) ?? undefined,
    createdAt: row.created_at as string,
    postedJournalEntryId: (row.posted_journal_entry_id as string) ?? undefined,
  };
}

export async function listContacts(): Promise<Contact[]> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.from('contacts').select('*').eq('active', true).order('name'),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapContact);
}

export async function saveContact(input: Partial<Contact> & { name: string; contactType: Contact['contactType'] }): Promise<{ success: boolean; error?: string }> {
  const payload = {
    id: input.id,
    contact_type: input.contactType,
    name: input.name,
    phone: input.phone ?? null,
    email: input.email ?? null,
    tax_pin: input.taxPin ?? null,
    source: input.source ?? 'admin',
    active: input.active ?? true,
  };

  const { error } = await retrySupabaseQuery(
    () => supabase.from('contacts').upsert(payload).select('id').single(),
    { maxRetries: 2 },
  );

  return error ? { success: false, error: error.message } : { success: true };
}

export async function listChartAccounts(): Promise<ChartAccount[]> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.from('chart_of_accounts').select('*').eq('active', true).order('code'),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapAccount);
}

export async function listTaxRates(): Promise<TaxRate[]> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.from('tax_rates').select('*').eq('active', true).order('name'),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapTaxRate);
}

export async function listAccountingItems(): Promise<AccountingItem[]> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.from('accounting_items').select('*').eq('active', true).order('name'),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapAccountingItem);
}

export async function postJournalEntry(input: JournalEntryInput): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('post_journal_entry', {
      p_source_type: input.sourceType,
      p_source_id: input.sourceId ?? null,
      p_entry_date: input.entryDate,
      p_memo: input.memo ?? null,
      p_lines: input.lines.map((line) => ({
        account_id: line.accountId,
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
        contact_id: line.contactId ?? null,
        tax_rate_id: line.taxRateId ?? null,
        description: line.description ?? null,
        metadata: line.metadata ?? {},
      })),
    }),
    { maxRetries: 2 },
  );

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Failed to post journal entry' };
  }

  return { success: true, id: data as string };
}

export async function reverseJournalEntry(id: string, entryDate: string, memo?: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('reverse_journal_entry', {
      p_journal_entry_id: id,
      p_entry_date: entryDate,
      p_memo: memo ?? null,
    }),
    { maxRetries: 2 },
  );

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Failed to reverse journal entry' };
  }

  return { success: true, id: data as string };
}

export async function listJournalEntries(limit = 50): Promise<JournalEntry[]> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase
      .from('ledger_journal_entries')
      .select('*')
      .order('entry_date', { ascending: false })
      .limit(limit),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapJournalEntry);
}

export async function listAccountBalances(business?: string): Promise<AccountBalance[]> {
  // Reads go through the SECURITY DEFINER RPC, not the ledger_account_balances
  // view (direct SELECT was revoked to close the cross-business read leak).
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_ledger_account_balances', { p_business: toBusinessParam(business) }).order('code'),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapAccountBalance);
}

export async function listBills(limit = 100): Promise<Bill[]> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase
      .from('bills')
      .select('*, contacts:supplier_contact_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapBill);
}

export async function createBill(input: CreateBillInput): Promise<AccountingOperationResult> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('create_bill_with_lines', {
      p_supplier_contact_id: input.supplierContactId,
      p_issue_date: input.issueDate,
      p_due_date: input.dueDate || null,
      p_notes: input.notes || null,
      p_lines: input.lines.map((line) => ({
        item_id: line.itemId ?? null,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        discount_amount: line.discountAmount ?? 0,
        tax_rate_id: line.taxRateId ?? null,
        tax_amount: line.taxAmount ?? 0,
        expense_account_id: line.expenseAccountId ?? null,
        metadata: line.metadata ?? {},
      })),
      p_post: input.post ?? true,
      p_business: input.businessId ?? null,
    }),
    { maxRetries: 2 },
  );

  if (error) return failedOperation(error, 'Failed to create bill');
  return mapOperationResult(data, 'Failed to create bill');
}

export async function createInvoice(input: CreateInvoiceInput): Promise<AccountingOperationResult> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('create_invoice_with_lines', {
      p_contact_id: input.contactId,
      p_issue_date: input.issueDate || null,
      p_due_date: input.dueDate || null,
      p_notes: input.notes || null,
      p_lines: mapInvoiceLinesInput(input.lines),
      p_status: input.status ?? 'pending',
      p_post: input.post ?? false,
      p_business: input.businessId ?? null,
    }),
    { maxRetries: 2 },
  );

  if (error) return failedOperation(error, 'Failed to create invoice');
  return mapOperationResult(data, 'Failed to create invoice');
}

export async function updateInvoice(input: UpdateInvoiceInput): Promise<AccountingOperationResult> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('update_draft_invoice_with_lines', {
      p_invoice_id: input.invoiceId,
      p_contact_id: input.contactId,
      p_issue_date: input.issueDate || null,
      p_due_date: input.dueDate || null,
      p_notes: input.notes || null,
      p_lines: mapInvoiceLinesInput(input.lines),
      p_status: input.status ?? 'pending',
      p_post: input.post ?? false,
    }),
    { maxRetries: 2 },
  );

  if (error) return failedOperation(error, 'Failed to update invoice');
  return mapOperationResult(data, 'Failed to update invoice');
}

export async function recordBillPayment(input: RecordBillPaymentInput): Promise<AccountingOperationResult> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('record_bill_payment', {
      p_bill_id: input.billId,
      p_amount: input.amount,
      p_method: input.method,
      p_reference: input.reference || null,
    }),
    { maxRetries: 2 },
  );

  if (error) return failedOperation(error, 'Failed to record bill payment');
  return mapOperationResult(data, 'Failed to record bill payment');
}

export async function listCreditNotes(limit = 100): Promise<CreditNote[]> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase
      .from('credit_notes')
      .select('*, contacts:contact_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapCreditNote);
}

export async function createCreditNote(input: CreateCreditNoteInput): Promise<AccountingOperationResult> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('create_credit_note_for_invoice', {
      p_invoice_id: input.invoiceId,
      p_amount: input.amount,
      p_reason: input.reason || null,
    }),
    { maxRetries: 2 },
  );

  if (error) return failedOperation(error, 'Failed to create credit note');
  return mapOperationResult(data, 'Failed to create credit note');
}

export async function listCustomerRefunds(limit = 100): Promise<CustomerRefund[]> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase
      .from('customer_refunds')
      .select('*, contacts:contact_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapCustomerRefund);
}

export async function recordCustomerRefund(input: RecordCustomerRefundInput): Promise<AccountingOperationResult> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('record_customer_refund', {
      p_invoice_id: input.invoiceId || null,
      p_payment_id: input.paymentId || null,
      p_amount: input.amount,
      p_method: input.method,
      p_reference: input.reference || null,
      p_reason: input.reason || null,
    }),
    { maxRetries: 2 },
  );

  if (error) return failedOperation(error, 'Failed to record refund');
  return mapOperationResult(data, 'Failed to record refund');
}

export async function allocateCustomerPayment(input: AllocateCustomerPaymentInput): Promise<AccountingOperationResult> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('allocate_customer_payment', {
      p_payment_id: input.paymentId,
      p_allocations: input.allocations.map((allocation) => ({
        invoice_id: allocation.invoiceId,
        amount: allocation.amount,
      })),
    }),
    { maxRetries: 2 },
  );

  if (error) return failedOperation(error, 'Failed to allocate payment');
  return mapOperationResult(data, 'Failed to allocate payment');
}

export async function getCustomerPaymentAllocationOptions(paymentId: string): Promise<CustomerPaymentAllocationOptions | null> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_customer_payment_allocation_options', { p_payment_id: paymentId }),
    { maxRetries: 2 },
  );

  if (error || !data) return null;
  return mapAllocationOptions(data as Record<string, unknown>);
}

export async function listCustomerCreditBalances(): Promise<CustomerCreditBalance[]> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('list_customer_credit_balances'),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(mapCustomerCreditBalance);
}

export async function postInvoiceToLedger(invoiceId: string): Promise<AccountingOperationResult> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('post_invoice_to_ledger', { p_invoice_id: invoiceId }),
    { maxRetries: 2 },
  );

  if (error) return failedOperation(error, 'Failed to post invoice');
  return mapOperationResult(data, 'Failed to post invoice');
}

export async function postPaymentReceivedToLedger(paymentId: string): Promise<AccountingOperationResult> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('post_payment_received_to_ledger', { p_payment_id: paymentId }),
    { maxRetries: 2 },
  );

  if (error) return failedOperation(error, 'Failed to post payment');
  return mapOperationResult(data, 'Failed to post payment');
}

export async function postExpenseToLedger(expenseId: string): Promise<AccountingOperationResult> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('post_expense_to_ledger', { p_expense_id: expenseId }),
    { maxRetries: 2 },
  );

  if (error) return failedOperation(error, 'Failed to post expense');
  return mapOperationResult(data, 'Failed to post expense');
}
