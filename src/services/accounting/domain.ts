import type { JournalEntryInput, JournalLineInput } from '@/types/accounting';

export interface JournalTotals {
  debit: number;
  credit: number;
  difference: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  totals: JournalTotals;
}

const MONEY_EPSILON = 0.01;

export function toMoney(value: number | undefined): number {
  if (!Number.isFinite(value ?? 0)) return 0;
  return Math.round((value ?? 0) * 100) / 100;
}

export function calculateJournalTotals(lines: JournalLineInput[]): JournalTotals {
  const debit = toMoney(lines.reduce((sum, line) => sum + toMoney(line.debit), 0));
  const credit = toMoney(lines.reduce((sum, line) => sum + toMoney(line.credit), 0));

  return {
    debit,
    credit,
    difference: toMoney(debit - credit),
  };
}

export function isBalancedJournal(lines: JournalLineInput[]): boolean {
  const totals = calculateJournalTotals(lines);
  return totals.debit > 0 && Math.abs(totals.difference) <= MONEY_EPSILON;
}

export function validateJournalEntry(input: JournalEntryInput): ValidationResult {
  const errors: string[] = [];
  const totals = calculateJournalTotals(input.lines);

  if (!input.sourceType) errors.push('sourceType is required');
  if (!input.entryDate) errors.push('entryDate is required');
  if (input.lines.length < 2) errors.push('at least two journal lines are required');

  for (const [index, line] of input.lines.entries()) {
    const debit = toMoney(line.debit);
    const credit = toMoney(line.credit);

    if (!line.accountId) errors.push(`line ${index + 1}: accountId is required`);
    if (debit < 0 || credit < 0) errors.push(`line ${index + 1}: debit/credit cannot be negative`);
    if (debit > 0 && credit > 0) errors.push(`line ${index + 1}: cannot contain both debit and credit`);
    if (debit === 0 && credit === 0) errors.push(`line ${index + 1}: debit or credit is required`);
  }

  if (totals.debit <= 0 || totals.credit <= 0) {
    errors.push('journal entry must contain debits and credits');
  }

  if (Math.abs(totals.difference) > MONEY_EPSILON) {
    errors.push(`journal entry is not balanced: debit ${totals.debit}, credit ${totals.credit}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    totals,
  };
}
