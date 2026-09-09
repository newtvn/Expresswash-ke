import type { Invoice } from '@/types';

export interface BillingMetrics {
  totalInvoiced: number;
  received: number;
  outstanding: number;
  overdue: number;
}

const ISSUED_STATUSES = new Set<Invoice['status']>([
  'sent',
  'pending',
  'paid',
  'partial',
  'partially_paid',
  'overdue',
]);

/**
 * Computes invoice KPIs from accounting amounts, not document counts.
 * Draft/cancelled documents are excluded; overdue is a subset of outstanding.
 */
export function invoiceIsOverdue(invoice: Invoice, today = new Date()): boolean {
  if (!ISSUED_STATUSES.has(invoice.status) || invoice.status === 'paid' || invoice.balance <= 0) return false;
  if (invoice.status === 'overdue') return true;
  const dueDate = invoice.dueAt?.slice(0, 10);
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return Boolean(dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate < localToday);
}

export function computeBillingMetrics(invoices: Invoice[], today = new Date()): BillingMetrics {
  return invoices.reduce<BillingMetrics>((metrics, invoice) => {
    if (!ISSUED_STATUSES.has(invoice.status)) return metrics;

    const total = Math.max(Number(invoice.total) || 0, 0);
    const received = Math.min(Math.max(Number(invoice.amountPaid) || 0, 0), total);
    const balance = Math.min(Math.max(Number(invoice.balance) || 0, 0), total);

    metrics.totalInvoiced += total;
    metrics.received += received;
    metrics.outstanding += balance;
    if (invoiceIsOverdue(invoice, today)) metrics.overdue += balance;
    return metrics;
  }, { totalInvoiced: 0, received: 0, outstanding: 0, overdue: 0 });
}
