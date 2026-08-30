import type {
  Contact,
  AllocateCustomerPaymentInput,
  CreateBillInput,
  CreateCreditNoteInput,
  CreateInvoiceInput,
  JournalEntryInput,
  RecordCustomerRefundInput,
  RecordBillPaymentInput,
  UpdateInvoiceInput,
} from '@/types/accounting';
import { validateJournalEntry } from './domain';
import * as repository from './repository';

export async function getAccountingSetup() {
  const [contacts, accounts, taxRates, items] = await Promise.all([
    repository.listContacts(),
    repository.listChartAccounts(),
    repository.listTaxRates(),
    repository.listAccountingItems(),
  ]);

  return {
    contacts,
    accounts,
    taxRates,
    items,
  };
}

export async function postBalancedJournalEntry(input: JournalEntryInput) {
  const validation = validateJournalEntry(input);

  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      totals: validation.totals,
    };
  }

  const result = await repository.postJournalEntry(input);
  return {
    success: result.success,
    id: result.id,
    errors: result.error ? [result.error] : [],
    totals: validation.totals,
  };
}

export async function reversePostedJournalEntry(id: string, entryDate: string, memo?: string) {
  return repository.reverseJournalEntry(id, entryDate, memo);
}

export async function getLedgerOverview(business?: string) {
  const [entries, balances] = await Promise.all([
    repository.listJournalEntries(),
    repository.listAccountBalances(business),
  ]);

  return {
    entries,
    balances,
  };
}

export async function saveAccountingContact(input: Partial<Contact> & { name: string; contactType: Contact['contactType'] }) {
  if (!input.name.trim()) {
    return { success: false, error: 'Contact name is required' };
  }

  return repository.saveContact(input);
}

export async function getOperationalAccounting() {
  const [bills, creditNotes, refunds, customerCredits] = await Promise.all([
    repository.listBills(),
    repository.listCreditNotes(),
    repository.listCustomerRefunds(),
    repository.listCustomerCreditBalances(),
  ]);

  return {
    bills,
    creditNotes,
    refunds,
    customerCredits,
  };
}

export async function createSupplierBill(input: CreateBillInput) {
  if (!input.supplierContactId) {
    return { success: false, error: 'Supplier is required' };
  }

  if (!input.lines.length) {
    return { success: false, error: 'At least one bill line is required' };
  }

  const invalidLine = input.lines.find((line) => !line.description.trim() || line.quantity <= 0 || line.unitPrice < 0);
  if (invalidLine) {
    return { success: false, error: 'Each bill line needs a description, quantity, and valid price' };
  }

  return repository.createBill(input);
}

function validateInvoiceInput(input: CreateInvoiceInput) {
  if (!input.contactId) {
    return 'Customer is required';
  }

  if (!input.lines.length) {
    return 'At least one invoice line is required';
  }

  const invalidLine = input.lines.find((line) => !line.description.trim() || line.quantity <= 0 || line.unitPrice < 0);
  if (invalidLine) {
    return 'Each invoice line needs a description, quantity, and valid price';
  }

  return null;
}

export async function createAccountingInvoice(input: CreateInvoiceInput) {
  const error = validateInvoiceInput(input);
  if (error) return { success: false, error };

  return repository.createInvoice(input);
}

export async function updateDraftAccountingInvoice(input: UpdateInvoiceInput) {
  if (!input.invoiceId) {
    return { success: false, error: 'Invoice is required' };
  }

  const error = validateInvoiceInput(input);
  if (error) return { success: false, error };

  return repository.updateInvoice(input);
}

export async function recordSupplierBillPayment(input: RecordBillPaymentInput) {
  if (!input.billId) {
    return { success: false, error: 'Bill is required' };
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: 'Payment amount must be greater than zero' };
  }

  return repository.recordBillPayment(input);
}

export async function createInvoiceCreditNote(input: CreateCreditNoteInput) {
  if (!input.invoiceId) {
    return { success: false, error: 'Invoice is required' };
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: 'Credit amount must be greater than zero' };
  }

  return repository.createCreditNote(input);
}

export async function recordCustomerRefund(input: RecordCustomerRefundInput) {
  if (!input.invoiceId && !input.paymentId) {
    return { success: false, error: 'Refund must reference an invoice or payment' };
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: 'Refund amount must be greater than zero' };
  }

  return repository.recordCustomerRefund(input);
}

export async function allocateCustomerPayment(input: AllocateCustomerPaymentInput) {
  if (!input.paymentId) {
    return { success: false, error: 'Payment is required' };
  }

  if (!input.allocations.length) {
    return { success: false, error: 'At least one allocation is required' };
  }

  const invalidAllocation = input.allocations.find((allocation) => !allocation.invoiceId || !Number.isFinite(allocation.amount) || allocation.amount <= 0);
  if (invalidAllocation) {
    return { success: false, error: 'Each allocation needs an invoice and a positive amount' };
  }

  return repository.allocateCustomerPayment(input);
}

export async function getCustomerPaymentAllocationOptions(paymentId: string) {
  if (!paymentId) return null;
  return repository.getCustomerPaymentAllocationOptions(paymentId);
}

export async function postInvoiceLedgerEntry(invoiceId: string) {
  if (!invoiceId) return { success: false, error: 'Invoice is required' };
  return repository.postInvoiceToLedger(invoiceId);
}

export async function postPaymentReceivedLedgerEntry(paymentId: string) {
  if (!paymentId) return { success: false, error: 'Payment is required' };
  return repository.postPaymentReceivedToLedger(paymentId);
}

export async function postExpenseLedgerEntry(expenseId: string) {
  if (!expenseId) return { success: false, error: 'Expense is required' };
  return repository.postExpenseToLedger(expenseId);
}
