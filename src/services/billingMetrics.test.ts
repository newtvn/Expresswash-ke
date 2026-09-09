import { describe, expect, it } from 'vitest';
import type { Invoice } from '@/types';
import { computeBillingMetrics } from './billingMetrics';

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: 'invoice-id',
    invoiceNumber: 'INV-1',
    orderId: 'order-id',
    orderNumber: 'ORD-1',
    customerId: 'customer-id',
    customerName: 'Customer',
    customerEmail: 'customer@example.com',
    items: [],
    subtotal: 1_000,
    vatRate: 0,
    vatAmount: 0,
    discount: 0,
    total: 1_000,
    amountPaid: 0,
    balance: 1_000,
    status: 'sent',
    issuedAt: '2026-09-01',
    dueAt: '2026-09-08',
    ...overrides,
  };
}

describe('computeBillingMetrics', () => {
  it('uses the remaining balance for partial and overdue invoices', () => {
    const result = computeBillingMetrics([
      invoice({ status: 'partially_paid', total: 1_000, amountPaid: 400, balance: 600, dueAt: '2026-09-10' }),
      invoice({ id: 'overdue', status: 'overdue', total: 2_000, amountPaid: 500, balance: 1_500 }),
    ], new Date(2026, 8, 9));

    expect(result).toEqual({
      totalInvoiced: 3_000,
      received: 900,
      outstanding: 2_100,
      overdue: 1_500,
    });
  });

  it('excludes draft and cancelled documents', () => {
    const result = computeBillingMetrics([
      invoice({ status: 'draft' }),
      invoice({ id: 'cancelled', status: 'cancelled' }),
      invoice({ id: 'paid', status: 'paid', amountPaid: 1_000, balance: 0 }),
    ]);

    expect(result).toEqual({
      totalInvoiced: 1_000,
      received: 1_000,
      outstanding: 0,
      overdue: 0,
    });
  });

  it('counts a past-due pending invoice as both outstanding and overdue', () => {
    const result = computeBillingMetrics([
      invoice({ status: 'pending', dueAt: '2026-09-08', balance: 750, total: 750 }),
    ], new Date(2026, 8, 9));

    expect(result.outstanding).toBe(750);
    expect(result.overdue).toBe(750);
  });
});
