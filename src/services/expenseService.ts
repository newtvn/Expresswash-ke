import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';

// ── Types ────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  receiptPath?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  expenseDate: string;
  createdAt: string;
}

export interface CreateExpensePayload {
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  expenseDate: string;
  receiptPath?: string;
}

export interface ExpenseFilters {
  category?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface ExpenseSummary {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface ExpenseKPIs {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

function mapExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    category: row.category as string,
    description: (row.description as string) ?? '',
    amount: row.amount as number,
    paymentMethod: (row.payment_method as string) ?? '',
    receiptPath: (row.receipt_path as string) ?? undefined,
    status: row.status as Expense['status'],
    createdBy: row.created_by as string,
    approvedBy: (row.approved_by as string) ?? undefined,
    approvedAt: (row.approved_at as string) ?? undefined,
    expenseDate: row.expense_date as string,
    createdAt: row.created_at as string,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────

/**
 * Create a new expense
 */
export async function createExpense(
  payload: CreateExpensePayload,
  userId: string,
): Promise<{ success: boolean; expense?: Expense; error?: string }> {
  const { data, error } = await retrySupabaseQuery(
    () =>
      supabase
        .from('expenses')
        .insert({
          category: payload.category,
          description: payload.description,
          amount: payload.amount,
          payment_method: payload.paymentMethod,
          expense_date: payload.expenseDate,
          receipt_path: payload.receiptPath ?? null,
          status: 'pending',
          created_by: userId,
        })
        .select()
        .single(),
    { maxRetries: 3 },
  );

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Failed to create expense' };
  }

  return { success: true, expense: mapExpense(data) };
}

/**
 * Get expenses with optional filters
 */
export async function getExpenses(filters: ExpenseFilters = {}): Promise<Expense[]> {
  let query = supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false });

  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.startDate) {
    query = query.gte('expense_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('expense_date', filters.endDate);
  }

  const { data, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });

  if (error || !data) return [];
  return data.map(mapExpense);
}

/**
 * Approve an expense
 */
export async function approveExpense(
  expenseId: string,
  adminId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await retrySupabaseQuery(
    () =>
      supabase
        .from('expenses')
        .update({
          status: 'approved',
          approved_by: adminId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', expenseId),
    { maxRetries: 3 },
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Reject an expense
 */
export async function rejectExpense(
  expenseId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await retrySupabaseQuery(
    () =>
      supabase
        .from('expenses')
        .update({ status: 'rejected' })
        .eq('id', expenseId),
    { maxRetries: 3 },
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Aggregations ─────────────────────────────────────────────────────

/**
 * Get expense breakdown by category for a given month
 */
export async function getExpenseSummary(month?: string): Promise<ExpenseSummary[]> {
  let query = supabase
    .from('expenses')
    .select('category, amount')
    .eq('status', 'approved');

  if (month) {
    // month format: "2026-02"
    query = query.gte('expense_date', `${month}-01`).lt('expense_date', getNextMonth(month));
  }

  const { data, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });

  if (error || !data || data.length === 0) return [];

  // Aggregate by category
  const byCategory: Record<string, { total: number; count: number }> = {};
  let grandTotal = 0;

  for (const row of data) {
    const cat = row.category as string;
    const amt = row.amount as number;
    if (!byCategory[cat]) {
      byCategory[cat] = { total: 0, count: 0 };
    }
    byCategory[cat].total += amt;
    byCategory[cat].count += 1;
    grandTotal += amt;
  }

  return Object.entries(byCategory)
    .map(([category, { total, count }]) => ({
      category,
      total,
      count,
      percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Get financial KPIs: revenue, expenses, net profit, margin
 */
export async function getExpenseKPIs(month?: string): Promise<ExpenseKPIs> {
  // Total revenue from paid invoices
  let revenueQuery = supabase
    .from('invoices')
    .select('total')
    .eq('status', 'paid');

  if (month) {
    revenueQuery = revenueQuery
      .gte('paid_at', `${month}-01`)
      .lt('paid_at', getNextMonth(month));
  }

  // Total approved expenses
  let expenseQuery = supabase
    .from('expenses')
    .select('amount')
    .eq('status', 'approved');

  if (month) {
    expenseQuery = expenseQuery
      .gte('expense_date', `${month}-01`)
      .lt('expense_date', getNextMonth(month));
  }

  const [revenueResult, expenseResult] = await Promise.all([
    retrySupabaseQuery(() => revenueQuery, { maxRetries: 2 }),
    retrySupabaseQuery(() => expenseQuery, { maxRetries: 2 }),
  ]);

  const totalRevenue = (revenueResult.data ?? []).reduce(
    (sum, r) => sum + ((r.total as number) ?? 0),
    0,
  );
  const totalExpenses = (expenseResult.data ?? []).reduce(
    (sum, r) => sum + ((r.amount as number) ?? 0),
    0,
  );
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0;

  return { totalRevenue, totalExpenses, netProfit, profitMargin };
}

// ── Utility ──────────────────────────────────────────────────────────

function getNextMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  if (mon === 12) return `${year + 1}-01-01`;
  return `${year}-${String(mon + 1).padStart(2, '0')}-01`;
}
