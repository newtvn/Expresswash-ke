import { describe, expect, it } from 'vitest';
import {
  calculateJournalTotals,
  isBalancedJournal,
  toMoney,
  validateJournalEntry,
} from './domain';

describe('accounting domain', () => {
  it('rounds money to two decimals', () => {
    expect(toMoney(10.005)).toBe(10.01);
    expect(toMoney(undefined)).toBe(0);
  });

  it('calculates journal totals', () => {
    expect(calculateJournalTotals([
      { accountId: 'cash', debit: 1200 },
      { accountId: 'revenue', credit: 1000 },
      { accountId: 'vat', credit: 200 },
    ])).toEqual({ debit: 1200, credit: 1200, difference: 0 });
  });

  it('accepts a balanced journal entry', () => {
    const result = validateJournalEntry({
      sourceType: 'invoice',
      sourceId: '11111111-1111-1111-1111-111111111111',
      entryDate: '2026-06-23',
      lines: [
        { accountId: 'ar', debit: 1160 },
        { accountId: 'revenue', credit: 1000 },
        { accountId: 'vat', credit: 160 },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(isBalancedJournal(result.valid ? [
      { accountId: 'ar', debit: 1160 },
      { accountId: 'revenue', credit: 1000 },
      { accountId: 'vat', credit: 160 },
    ] : [])).toBe(true);
  });

  it('rejects an unbalanced journal entry', () => {
    const result = validateJournalEntry({
      sourceType: 'payment_received',
      entryDate: '2026-06-23',
      lines: [
        { accountId: 'bank', debit: 1000 },
        { accountId: 'ar', credit: 950 },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('not balanced');
  });

  it('rejects a line with both debit and credit', () => {
    const result = validateJournalEntry({
      sourceType: 'manual_adjustment',
      entryDate: '2026-06-23',
      lines: [
        { accountId: 'bank', debit: 100, credit: 100 },
        { accountId: 'equity', credit: 100 },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('cannot contain both debit and credit');
  });
});
