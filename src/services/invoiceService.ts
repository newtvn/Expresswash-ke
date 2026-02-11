import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';
import {
  Invoice,
  InvoiceItem,
  Payment,
  InvoiceFilters,
  PaginatedResponse,
} from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────

function mapInvoice(row: Record<string, unknown>, items: Record<string, unknown>[]): Invoice {
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
    subtotal: row.subtotal as number,
    vatRate: row.vat_rate as number,
    vatAmount: row.vat_amount as number,
    discount: (row.discount as number) ?? 0,
    total: row.total as number,
    status: row.status as Invoice['status'],
    issuedAt: row.issued_at as string,
    dueAt: row.due_at as string,
    paidAt: (row.paid_at as string) ?? undefined,
    pdfUrl: (row.pdf_url as string) ?? undefined,
  };
}

function mapPayment(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    invoiceId: row.invoice_id as string,
    invoiceNumber: row.invoice_number as string,
    amount: row.amount as number,
    method: row.method as Payment['method'],
    reference: row.reference as string,
    mpesaReceiptNumber: (row.mpesa_receipt_number as string) ?? undefined,
    status: row.status as Payment['status'],
    recordedBy: row.recorded_by as string,
    notes: (row.notes as string) ?? undefined,
    createdAt: row.created_at as string,
  };
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

  const start = (filters.page - 1) * filters.limit;
  query = query.range(start, start + filters.limit - 1).order('issued_at', { ascending: false });

  const { data: invoices, count, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });

  if (error || !invoices) {
    return { data: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0 };
  }

  const invoiceIds = invoices.map((inv) => inv.id);
  const { data: allItems } = await retrySupabaseQuery(
    () => supabase.from('invoice_items').select('*').in('invoice_id', invoiceIds),
    { maxRetries: 2 }
  );

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

export const getPayments = async (
  invoiceId?: string,
): Promise<Payment[]> => {
  let query = supabase.from('payments').select('*').order('created_at', { ascending: false });

  if (invoiceId) {
    query = query.eq('invoice_id', invoiceId);
  }

  const { data, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });
  if (error || !data) return [];
  return data.map(mapPayment);
};

export const createInvoice = async (
  data: Omit<Invoice, 'id' | 'invoiceNumber' | 'issuedAt'>,
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
