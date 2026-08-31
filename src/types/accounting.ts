export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type NormalBalance = 'debit' | 'credit';
export type ContactType = 'customer' | 'supplier' | 'both';
export type LedgerSourceType =
  | 'invoice'
  | 'payment_received'
  | 'expense'
  | 'bill'
  | 'payment_made'
  | 'credit_note'
  | 'manual_adjustment'
  | 'reversal';

export interface Contact {
  id: string;
  contactType: ContactType;
  name: string;
  phone?: string;
  email?: string;
  taxPin?: string;
  appUserId?: string;
  source: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  parentId?: string;
  normalBalance: NormalBalance;
  description?: string;
  systemKey?: string;
  active: boolean;
}

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
  taxType: 'vat' | 'withholding' | 'other';
  isDefault: boolean;
  active: boolean;
}

export interface AccountingItem {
  id: string;
  name: string;
  itemType: 'service' | 'product' | 'fee';
  defaultPrice: number;
  salesAccountId?: string;
  expenseAccountId?: string;
  taxRateId?: string;
  active: boolean;
}

export interface Bill {
  id: string;
  billNumber: string;
  supplierContactId?: string;
  supplierName?: string;
  status: 'draft' | 'open' | 'partially_paid' | 'paid' | 'overdue' | 'void';
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  postedJournalEntryId?: string;
  notes?: string;
  createdAt: string;
}

export interface BillLineInput {
  itemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxRateId?: string;
  taxAmount?: number;
  expenseAccountId?: string;
  metadata?: Record<string, unknown>;
}

export interface InvoiceLineInput {
  itemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxRateId?: string;
  taxAmount?: number;
  revenueAccountId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateInvoiceInput {
  contactId: string;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  status?: 'draft' | 'pending' | 'sent';
  post?: boolean;
  lines: InvoiceLineInput[];
  /** Business slug (super_admin only); omit for the caller's own business. */
  businessId?: string;
}

export interface UpdateInvoiceInput extends CreateInvoiceInput {
  invoiceId: string;
}

export interface CreateBillInput {
  supplierContactId: string;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  lines: BillLineInput[];
  post?: boolean;
  /** Business slug (super_admin only); omit for the caller's own business. */
  businessId?: string;
}

export interface RecordBillPaymentInput {
  billId: string;
  amount: number;
  method: 'cash' | 'mpesa' | 'bank_transfer' | 'card';
  reference?: string;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  invoiceId?: string;
  contactId?: string;
  contactName?: string;
  status: 'draft' | 'issued' | 'applied' | 'void';
  issueDate: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  appliedAmount: number;
  reason?: string;
  postedJournalEntryId?: string;
  createdAt: string;
}

export interface CustomerRefund {
  id: string;
  refundNumber: string;
  contactId?: string;
  contactName?: string;
  invoiceId?: string;
  paymentId?: string;
  amount: number;
  method: 'cash' | 'mpesa' | 'bank_transfer' | 'card' | 'qr_code';
  reference?: string;
  reason?: string;
  status: 'recorded' | 'void';
  postedJournalEntryId?: string;
  createdAt: string;
}

export interface CreateCreditNoteInput {
  invoiceId: string;
  amount: number;
  reason?: string;
}

export interface RecordCustomerRefundInput {
  invoiceId?: string;
  paymentId?: string;
  amount: number;
  method: 'cash' | 'mpesa' | 'bank_transfer' | 'card' | 'qr_code';
  reference?: string;
  reason?: string;
}

export interface PaymentAllocationInput {
  invoiceId: string;
  amount: number;
}

export interface AllocateCustomerPaymentInput {
  paymentId: string;
  allocations: PaymentAllocationInput[];
}

export interface CustomerPaymentAllocationOption {
  invoiceId: string;
  invoiceNumber: string;
  customerName?: string;
  total: number;
  paidAmount: number;
  balance: number;
  currentPaymentAllocation: number;
  dueDate?: string;
  status: string;
}

export interface ExistingCustomerPaymentAllocation {
  invoiceId: string;
  invoiceNumber: string;
  customerName?: string;
  amountAllocated: number;
  invoiceBalance: number;
  allocatedAt?: string;
}

export interface CustomerPaymentAllocationOptions {
  payment: {
    id: string;
    amount: number;
    allocatedAmount: number;
    unappliedAmount: number;
    customerId?: string;
    customerName?: string;
    status: string;
    postedJournalEntryId?: string;
  };
  allocations: ExistingCustomerPaymentAllocation[];
  openInvoices: CustomerPaymentAllocationOption[];
}

export interface CustomerCreditBalance {
  paymentId: string;
  customerId?: string;
  customerName?: string;
  amount: number;
  allocatedAmount: number;
  unappliedAmount: number;
  method?: string;
  provider?: string;
  providerReference?: string;
  createdAt: string;
  postedJournalEntryId?: string;
}

export interface AccountingOperationResult {
  success: boolean;
  error?: string;
  idempotent?: boolean;
  journalEntryId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  paymentId?: string;
  billId?: string;
  billNumber?: string;
  paymentMadeId?: string;
  creditNoteId?: string;
  creditNoteNumber?: string;
  refundId?: string;
  refundNumber?: string;
  status?: string;
  balance?: number;
  balanceDue?: number;
}

export interface JournalLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
  contactId?: string;
  taxRateId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface JournalEntryInput {
  sourceType: LedgerSourceType;
  sourceId?: string;
  entryDate: string;
  memo?: string;
  lines: JournalLineInput[];
  /** Business slug this entry belongs to; required for manual entries to be per-business scoped. */
  businessId?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  sourceType: LedgerSourceType;
  sourceId?: string;
  entryDate: string;
  memo?: string;
  status: 'draft' | 'posted' | 'voided' | 'reversed';
  postedAt?: string;
  createdAt: string;
}

export interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export interface LedgerReportAccountRow {
  code: string;
  name: string;
  amount?: number;
  balance?: number;
}

export interface LedgerProfitAndLossReport {
  from: string | null;
  to: string | null;
  income: LedgerReportAccountRow[];
  expenses: LedgerReportAccountRow[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

export interface LedgerBalanceSheetReport {
  asOf: string;
  assets: LedgerReportAccountRow[];
  liabilities: LedgerReportAccountRow[];
  equity: LedgerReportAccountRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
}

export interface VatSummaryReport {
  from: string | null;
  to: string | null;
  outputVat: number;
  inputVat: number;
  netVatPayable: number;
}

export interface CashFlowRow {
  sourceType: string;
  label: string;
  amount: number;
}

export interface LedgerCashFlowReport {
  from: string | null;
  to: string | null;
  inflows: CashFlowRow[];
  outflows: CashFlowRow[];
  totalInflows: number;
  totalOutflows: number;
  netCashFlow: number;
}

export interface AgingReportItem {
  invoiceId?: string;
  invoiceNumber?: string;
  billId?: string;
  billNumber?: string;
  customerName?: string;
  supplierName?: string;
  dueDate: string;
  balanceDue: number;
  daysOverdue: number;
}

export interface AgingReport {
  asOf: string;
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  items: AgingReportItem[];
}

export type NotificationChannel = 'whatsapp' | 'sms' | 'email' | 'push' | 'webhook';
export type NotificationOutboxStatus =
  | 'pending'
  | 'processing'
  | 'delivered'
  | 'failed'
  | 'dead_letter'
  | 'cancelled';

export interface NotificationOutboxItem {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId?: string;
  channel: NotificationChannel;
  recipientContact: string;
  recipientName?: string;
  payload: Record<string, unknown>;
  status: NotificationOutboxStatus;
  idempotencyKey: string;
  availableAt: string;
  attemptCount: number;
  maxAttempts: number;
  lastError?: string;
  provider?: string;
  providerMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueNotificationInput {
  eventType: string;
  aggregateType: string;
  aggregateId?: string;
  channel: NotificationChannel;
  recipientContact: string;
  recipientName?: string;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
  availableAt?: string;
}
