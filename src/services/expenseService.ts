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
  business?: string;
}

export interface ExpenseFilters {
  category?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  business?: string;
  postedOnly?: boolean;
}

export interface ExpenseSummary {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

function mapExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    category: row.category as string,
    description: (row.description as string) ?? '',
    amount: Number(row.amount) || 0,
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
  if (!payload.description.trim() || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    return { success: false, error: 'Expense requires a description and an amount greater than zero' };
  }
  if (!userId) {
    return { success: false, error: 'An authenticated user is required' };
  }
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
          business: payload.business ?? 'expresswash',
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
  if (filters.business && filters.business !== 'all') {
    query = query.eq('business', filters.business);
  }
  if (filters.postedOnly) {
    query = query.not('posted_journal_entry_id', 'is', null);
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
  _adminId?: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('approve_and_post_expense', { p_expense_id: expenseId }),
    { maxRetries: 3 },
  );

  if (error) return { success: false, error: error.message };
  const result = (data ?? {}) as Record<string, unknown>;
  return result.success === false
    ? { success: false, error: String(result.error ?? 'Failed to approve expense') }
    : { success: true };
}

/**
 * Reject an expense
 */
export async function rejectExpense(
  expenseId: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('reject_unposted_expense', { p_expense_id: expenseId }),
    { maxRetries: 3 },
  );

  if (error) return { success: false, error: error.message };
  const result = (data ?? {}) as Record<string, unknown>;
  return result.success === false
    ? { success: false, error: String(result.error ?? 'Failed to reject expense') }
    : { success: true };
}

// ── Aggregations ─────────────────────────────────────────────────────

/**
 * Get expense breakdown by category for a given month
 */
export async function getExpenseSummary(filters: ExpenseFilters = {}): Promise<ExpenseSummary[]> {
  let query = supabase
    .from('expenses')
    .select('category, amount')
    .eq('status', 'approved')
    .not('posted_journal_entry_id', 'is', null);

  if (filters.startDate) query = query.gte('expense_date', filters.startDate);
  if (filters.endDate) query = query.lte('expense_date', filters.endDate);
  if (filters.business && filters.business !== 'all') query = query.eq('business', filters.business);

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
