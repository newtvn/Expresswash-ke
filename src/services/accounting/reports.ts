import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';
import { toBusinessParam } from '@/types/business';
import type {
  AgingReport,
  AgingReportItem,
  CashFlowRow,
  LedgerBalanceSheetReport,
  LedgerCashFlowReport,
  LedgerProfitAndLossReport,
  LedgerReportAccountRow,
  VatSummaryReport,
} from '@/types/accounting';

function parseRpcJson(data: unknown): Record<string, unknown> {
  if (!data) return {};
  if (typeof data === 'string') return JSON.parse(data) as Record<string, unknown>;
  return data as Record<string, unknown>;
}

function money(value: unknown): number {
  return Number(value) || 0;
}

function mapAccountRows(rows: unknown, amountKey: 'amount' | 'balance'): LedgerReportAccountRow[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      code: String(record.code ?? ''),
      name: String(record.name ?? ''),
      [amountKey]: money(record[amountKey]),
    };
  });
}

function mapAgingItems(rows: unknown): AgingReportItem[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      invoiceId: (record.invoice_id as string) ?? undefined,
      invoiceNumber: (record.invoice_number as string) ?? undefined,
      billId: (record.bill_id as string) ?? undefined,
      billNumber: (record.bill_number as string) ?? undefined,
      customerName: (record.customer_name as string) ?? undefined,
      supplierName: (record.supplier_name as string) ?? undefined,
      dueDate: String(record.due_date ?? ''),
      balanceDue: money(record.balance_due),
      daysOverdue: Number(record.days_overdue) || 0,
    };
  });
}

function mapAgingReport(data: unknown): AgingReport {
  const report = parseRpcJson(data);

  return {
    asOf: String(report.as_of ?? ''),
    current: money(report.current),
    days1To30: money(report.days_1_30),
    days31To60: money(report.days_31_60),
    days61To90: money(report.days_61_90),
    days90Plus: money(report.days_90_plus),
    items: mapAgingItems(report.items),
  };
}

function mapCashFlowRows(rows: unknown): CashFlowRow[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      sourceType: String(record.source_type ?? ''),
      label: String(record.label ?? ''),
      amount: money(record.amount),
    };
  });
}

export async function getLedgerProfitAndLoss(from?: string, to?: string, business?: string): Promise<LedgerProfitAndLossReport> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_ledger_profit_and_loss', {
      p_from: from ?? null,
      p_to: to ?? null,
      p_business: toBusinessParam(business),
    }),
    { maxRetries: 2 },
  );

  const report = error ? {} : parseRpcJson(data);

  return {
    from: (report.from as string) ?? from ?? null,
    to: (report.to as string) ?? to ?? null,
    income: mapAccountRows(report.income, 'amount'),
    expenses: mapAccountRows(report.expenses, 'amount'),
    totalIncome: money(report.total_income),
    totalExpenses: money(report.total_expenses),
    netProfit: money(report.net_profit),
  };
}

export async function getLedgerCashFlow(from?: string, to?: string, business?: string): Promise<LedgerCashFlowReport> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_ledger_cash_flow', {
      p_from: from ?? null,
      p_to: to ?? null,
      p_business: toBusinessParam(business),
    }),
    { maxRetries: 2 },
  );

  const report = error ? {} : parseRpcJson(data);

  return {
    from: (report.from as string) ?? from ?? null,
    to: (report.to as string) ?? to ?? null,
    inflows: mapCashFlowRows(report.inflows),
    outflows: mapCashFlowRows(report.outflows),
    totalInflows: money(report.total_inflows),
    totalOutflows: money(report.total_outflows),
    netCashFlow: money(report.net_cash_flow),
  };
}

export async function getLedgerBalanceSheet(asOf?: string, business?: string): Promise<LedgerBalanceSheetReport> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_ledger_balance_sheet', { p_as_of: asOf ?? null, p_business: toBusinessParam(business) }),
    { maxRetries: 2 },
  );

  const report = error ? {} : parseRpcJson(data);

  return {
    asOf: String(report.as_of ?? asOf ?? ''),
    assets: mapAccountRows(report.assets, 'balance'),
    liabilities: mapAccountRows(report.liabilities, 'balance'),
    equity: mapAccountRows(report.equity, 'balance'),
    totalAssets: money(report.total_assets),
    totalLiabilities: money(report.total_liabilities),
    totalEquity: money(report.total_equity),
    balanced: Boolean(report.balanced),
  };
}

export async function getVatSummary(from?: string, to?: string, business?: string): Promise<VatSummaryReport> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_vat_summary', {
      p_from: from ?? null,
      p_to: to ?? null,
      p_business: toBusinessParam(business),
    }),
    { maxRetries: 2 },
  );

  const report = error ? {} : parseRpcJson(data);

  return {
    from: (report.from as string) ?? from ?? null,
    to: (report.to as string) ?? to ?? null,
    outputVat: money(report.output_vat),
    inputVat: money(report.input_vat),
    netVatPayable: money(report.net_vat_payable),
  };
}

export async function getReceivablesAging(asOf?: string, business?: string): Promise<AgingReport> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_receivables_aging', { p_as_of: asOf ?? null, p_business: toBusinessParam(business) }),
    { maxRetries: 2 },
  );

  return mapAgingReport(error ? null : data);
}

export async function getPayablesAging(asOf?: string, business?: string): Promise<AgingReport> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.rpc('get_payables_aging', { p_as_of: asOf ?? null, p_business: toBusinessParam(business) }),
    { maxRetries: 2 },
  );

  return mapAgingReport(error ? null : data);
}
