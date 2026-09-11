import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';
import type { Payment } from '@/types/payment';
import {
  Invoice,
  InvoiceItem,
  InvoiceFilters,
  PaginatedResponse,
} from '@/types';
import { toLocalDateString } from '@/lib/localDate';

// ── Helpers ───────────────────────────────────────────────────────────

function mapInvoice(row: Record<string, unknown>, items: Record<string, unknown>[]): Invoice {
  const total = Number(row.total) || 0;
  const amountPaid = Number(row.paid_amount) || 0;
  return {
    id: row.id as string,
    invoiceNumber: row.invoice_number as string,
    orderId: row.order_id as string,
    orderNumber: row.order_number as string,
    customerId: row.customer_id as string,
    customerName: row.customer_name as string,
    customerEmail: row.customer_email as string,
    items: items.map((i) => ({
      description: i.description as string,
      quantity: i.quantity as number,
      unitPrice: i.unit_price as number,
      total: i.total as number,
    })),
    subtotal: Number(row.subtotal) || 0,
    vatRate: Number(row.vat_rate) || 0,
    vatAmount: Number(row.vat_amount) || 0,
    discount: Number(row.discount) || 0,
    total,
    amountPaid,
    balance: row.balance == null ? Math.max(total - amountPaid, 0) : Number(row.balance) || 0,
    status: row.status as Invoice['status'],
    issuedAt: (row.issued_at as string) ?? (row.created_at as string),
    dueAt: (row.due_at as string) ?? (row.due_date as string) ?? '',
    paidAt: (row.paid_at as string) ?? undefined,
    pdfUrl: (row.pdf_url as string) ?? undefined,
  };
}

function mapPayment(row: Record<string, unknown>): Payment {
  const orders = row.orders as Record<string, unknown> | null;
  return {
    id: row.id as string,
    orderId: (row.order_id as string) ?? undefined,
    invoiceId: (row.invoice_id as string) ?? undefined,
    invoiceNumber: (row.invoice_number as string) ?? (orders?.tracking_code as string) ?? undefined,
    amount: row.amount as number,
    method: row.method as Payment['method'],
    status: row.status as Payment['status'],
    phoneNumber: (row.phone_number as string) ?? undefined,
    customerName: (row.customer_name as string) ?? undefined,
    recordedBy: (row.recorded_by as string) ?? undefined,
    merchantRequestId: (row.merchant_request_id as string) ?? undefined,
    checkoutRequestId: (row.checkout_request_id as string) ?? undefined,
    reference: (row.reference as string) ?? undefined,
    referenceNumber: (row.reference_number as string) ?? undefined,
    mpesaReceiptNumber: (row.mpesa_receipt_number as string) ?? undefined,
    resultCode: (row.result_code as number) ?? undefined,
    resultDesc: (row.result_desc as string) ?? undefined,
    failureReason: (row.failure_reason as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? undefined,
    completedAt: (row.completed_at as string) ?? undefined,
  };
}

export interface PaymentPage {
  rows: Payment[];
  total: number;
}

export interface CustomerBillingSummary {
  paidThisMonth: number;
  outstanding: number;
  totalPaid: number;
}

export interface DriverCashSummary {
  totalCollected: number;
  remitted: number;
  toRemit: number;
}

export type BillingInvoiceView = 'all' | 'pending' | 'paid' | 'overdue';

export interface BillingInvoicePage {
  rows: Invoice[];
  total: number;
}

export interface BillingFinancialSummary {
  totalCount: number;
  pendingCount: number;
  paidCount: number;
  overdueCount: number;
  totalInvoiced: number;
  received: number;
  outstanding: number;
  overdue: number;
}

// ── Public API ────────────────────────────────────────────────────────

export const getInvoices = async (
  filters: InvoiceFilters = { page: 1, limit: 10 },
): Promise<PaginatedResponse<Invoice>> => {
  let query = supabase.from('invoices').select('*', { count: 'exact' });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }
  if (filters.startDate) {
    query = query.gte('issued_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('issued_at', filters.endDate);
  }
  if (filters.search) {
    query = query.or(
      `invoice_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,order_number.ilike.%${filters.search}%`,
    );
  }
  if (filters.business && filters.business !== 'all') {
    query = query.eq('business', filters.business);
  }

  const start = (filters.page - 1) * filters.limit;
  query = query.range(start, start + filters.limit - 1).order('issued_at', { ascending: false });

  const { data: invoices, count, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });

  if (error) throw new Error(error.message);
  if (!invoices) return { data: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0 };

  if (invoices.length === 0) {
    return { data: [], total: count ?? 0, page: filters.page, limit: filters.limit, totalPages: 0 };
  }

  const invoiceIds = invoices.map((inv) => inv.id);
  const { data: allItems, error: itemsError } = await retrySupabaseQuery(
    () => supabase.from('invoice_items').select('*').in('invoice_id', invoiceIds),
    { maxRetries: 2 }
  );
  if (itemsError) throw new Error(itemsError.message);

  const itemsByInvoice = (allItems ?? []).reduce<Record<string, Record<string, unknown>[]>>((acc, item) => {
    const iid = item.invoice_id as string;
    if (!acc[iid]) acc[iid] = [];
    acc[iid].push(item);
    return acc;
  }, {});

  const data = invoices.map((inv) => mapInvoice(inv, itemsByInvoice[inv.id] ?? []));
  const total = count ?? 0;

  return {
    data,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
};

/** Fetches every invoice page so accounting totals are never capped by a UI page size. */
export const getAllInvoices = async (filters: Omit<InvoiceFilters, 'page' | 'limit'> = {}): Promise<Invoice[]> => {
  const limit = 500;
  const first = await getInvoices({ ...filters, page: 1, limit });
  if (first.totalPages <= 1) return first.data;

  const remaining = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) => getInvoices({ ...filters, page: index + 2, limit })),
  );
  return [first, ...remaining].flatMap((page) => page.data);
};

export const getBillingInvoicesPage = async (params: {
  business?: string;
  view: BillingInvoiceView;
  page: number;
  pageSize: number;
  search?: string;
}): Promise<BillingInvoicePage> => {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_billing_invoices_page', {
      p_business: params.business && params.business !== 'all' ? params.business : null,
      p_view: params.view,
      p_offset: params.page * params.pageSize,
      p_limit: params.pageSize,
      p_search: params.search?.trim() || null,
    }),
    { maxRetries: 2 },
  );
  if (error) throw new Error(error.message);
  const value = typeof data === 'string' ? JSON.parse(data) : data;
  return {
    rows: (value?.rows ?? []).map((row: Record<string, unknown>) => mapInvoice(row, [])),
    total: Number(value?.total ?? 0),
  };
};

export const getBillingFinancialSummary = async (business?: string): Promise<BillingFinancialSummary> => {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_billing_financial_summary', {
      p_business: business && business !== 'all' ? business : null,
    }),
    { maxRetries: 2 },
  );
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalCount: Number(row?.total_count) || 0,
    pendingCount: Number(row?.pending_count) || 0,
    paidCount: Number(row?.paid_count) || 0,
    overdueCount: Number(row?.overdue_count) || 0,
    totalInvoiced: Number(row?.total_invoiced) || 0,
    received: Number(row?.received_total) || 0,
    outstanding: Number(row?.outstanding_total) || 0,
    overdue: Number(row?.overdue_total) || 0,
  };
};

export const getInvoiceById = async (invoiceId: string): Promise<Invoice | null> => {
  const { data: invoice } = await retrySupabaseQuery(
    () => supabase.from('invoices').select('*').eq('id', invoiceId).single(),
    { maxRetries: 2 }
  );

  if (!invoice) return null;

  const { data: items } = await retrySupabaseQuery(
    () => supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId),
    { maxRetries: 2 }
  );

  return mapInvoice(invoice, items ?? []);
};

/** Server-paginated payment history for customer, driver, or invoice views. */
export const getPaymentsPage = async (params: {
  page: number;
  pageSize: number;
  customerId?: string;
  recordedBy?: string;
  invoiceId?: string;
  search?: string;
  from?: string;
  to?: string;
}): Promise<PaymentPage> => {
  const fromRow = params.page * params.pageSize;
  let query = supabase
    .from('payments')
    .select('*, orders:order_id(tracking_code)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(fromRow, fromRow + params.pageSize - 1);

  if (params.customerId) query = query.eq('customer_id', params.customerId);
  if (params.recordedBy) query = query.eq('recorded_by', params.recordedBy);
  if (params.invoiceId) query = query.eq('invoice_id', params.invoiceId);
  if (params.from) query = query.gte('created_at', params.from);
  if (params.to) query = query.lt('created_at', params.to);

  const term = params.search?.trim();
  if (term) query = query.or(
    `invoice_number.ilike.%${term}%,reference.ilike.%${term}%,reference_number.ilike.%${term}%,mpesa_receipt_number.ilike.%${term}%`,
  );

  const { data, count, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });
  if (error) throw new Error(error.message);
  return { rows: (data ?? []).map(mapPayment), total: count ?? 0 };
};

export const getCustomerBillingSummary = async (customerId: string): Promise<CustomerBillingSummary> => {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_customer_billing_summary', { p_customer_id: customerId }),
    { maxRetries: 2 },
  );
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { paidThisMonth: 0, outstanding: 0, totalPaid: 0 };
  return {
    paidThisMonth: Number(row.paid_this_month) || 0,
    outstanding: Number(row.outstanding) || 0,
    totalPaid: Number(row.total_paid) || 0,
  };
};

export const getDriverCashSummary = async (driverId: string): Promise<DriverCashSummary> => {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_driver_cash_summary', {
      p_driver_id: driverId,
      p_day: toLocalDateString(new Date()),
    }),
    { maxRetries: 2 },
  );
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { totalCollected: 0, remitted: 0, toRemit: 0 };
  return {
    totalCollected: Number(row.total_collected) || 0,
    remitted: Number(row.remitted) || 0,
    toRemit: Number(row.to_remit) || 0,
  };
};

export const createInvoice = async (
  data: Omit<Invoice, 'id' | 'invoiceNumber' | 'issuedAt' | 'amountPaid' | 'balance'>,
): Promise<{ success: boolean; invoice?: Invoice }> => {
  const { data: inserted, error } = await retrySupabaseQuery(
    () => supabase
      .from('invoices')
      .insert({
        order_id: data.orderId,
        order_number: data.orderNumber,
        customer_id: data.customerId,
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        subtotal: data.subtotal,
        vat_rate: data.vatRate,
        vat_amount: data.vatAmount,
        discount: data.discount,
        total: data.total,
        status: data.status,
        due_at: data.dueAt,
        paid_at: data.paidAt ?? null,
      })
      .select()
      .single(),
    { maxRetries: 3 }
  );

  if (error || !inserted) return { success: false };

  if (data.items.length > 0) {
    await retrySupabaseQuery(
      () => supabase.from('invoice_items').insert(
        data.items.map((item) => ({
          invoice_id: inserted.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.total,
        })),
      ),
      { maxRetries: 3 }
    );
  }

  const invoice = await getInvoiceById(inserted.id);
  return { success: true, invoice: invoice ?? undefined };
};

export const updateInvoiceStatus = async (
  id: string,
  status: Invoice['status'],
): Promise<{ success: boolean; invoice?: Invoice }> => {
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'paid') {
    updateData.paid_at = new Date().toISOString();
  }

  const { error } = await retrySupabaseQuery(
    () => supabase.from('invoices').update(updateData).eq('id', id),
    { maxRetries: 3 }
  );

  if (error) return { success: false };

  const invoice = await getInvoiceById(id);
  return { success: true, invoice: invoice ?? undefined };
};

export const recordPayment = async (
  payment: Omit<Payment, 'id' | 'createdAt'>,
): Promise<{ success: boolean; payment?: Payment }> => {
  const { data, error } = await retrySupabaseQuery(
    () => supabase
      .from('payments')
      .insert({
        order_id: payment.orderId ?? null,
        invoice_id: payment.invoiceId,
        invoice_number: payment.invoiceNumber,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        mpesa_receipt_number: payment.mpesaReceiptNumber ?? null,
        status: payment.status,
        recorded_by: payment.recordedBy,
        notes: payment.notes ?? null,
      })
      .select()
      .single(),
    { maxRetries: 3 }
  );

  if (error || !data) return { success: false };
  return { success: true, payment: mapPayment(data) };
};
