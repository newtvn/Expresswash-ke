import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Package, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import type {
  ChartAccount,
  JournalEntry,
  LedgerBalanceSheetReport,
  LedgerCashFlowReport,
  LedgerProfitAndLossReport,
  LedgerReportAccountRow,
  VatSummaryReport,
} from '@/types/accounting';

type DateRange = { from: Date | undefined; to: Date | undefined };
type SalesOrderRow = { total: number | string; customer_name?: string };
type SalesByPersonRow = { name: string; total: number };
type SalesByItemRow = { name: string; quantity: number; total: number };

const CHART_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed'];

interface AccountsReportsPanelProps {
  dateRange: DateRange;
  reportRangeLabel: string;
  chartAccounts: ChartAccount[];
  entries: JournalEntry[];
  orders: SalesOrderRow[];
  salesByPersonData: SalesByPersonRow[];
  salesByItem: SalesByItemRow[];
  /** Operational sales widgets are Expresswash-specific; hide them for other businesses. */
  showOperationalSales?: boolean;
  profitAndLoss?: LedgerProfitAndLossReport;
  balanceSheet?: LedgerBalanceSheetReport;
  vatSummary?: VatSummaryReport;
  cashFlow?: LedgerCashFlowReport;
  reversePending: boolean;
  setDateRange: (range: DateRange) => void;
  formatCurrency: (value: number | undefined) => string;
  formatDate: (value?: string | null) => string;
  onReverseJournalEntry: (entry: JournalEntry) => void;
}

const formatAccount = (account: ChartAccount) => `${account.code} · ${account.name}`;

function ReportRows({
  title,
  rows,
  empty,
  formatCurrency,
}: {
  title: string;
  rows: LedgerReportAccountRow[];
  empty: string;
  formatCurrency: (value: number | undefined) => string;
}) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-1">
          {rows.map((row) => (
            <div key={`${title}-${row.code}`} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{row.code} · {row.name}</span>
              <span className="font-medium">{formatCurrency(row.amount ?? row.balance)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AccountsReportsPanel({
  dateRange,
  reportRangeLabel,
  chartAccounts,
  entries,
  orders,
  salesByPersonData,
  salesByItem,
  showOperationalSales = true,
  profitAndLoss,
  balanceSheet,
  vatSummary,
  cashFlow,
  reversePending,
  setDateRange,
  formatCurrency,
  formatDate,
  onReverseJournalEntry,
}: AccountsReportsPanelProps) {
  const incomeAccounts = chartAccounts.filter((account) => account.accountType === 'income');
  const expenseAccounts = chartAccounts.filter((account) => account.accountType === 'expense');
  const assetAccounts = chartAccounts.filter((account) => account.accountType === 'asset');
  const liabilityAccounts = chartAccounts.filter((account) => account.accountType === 'liability');
  const equityAccounts = chartAccounts.filter((account) => account.accountType === 'equity');

  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Ledger Reports</p>
          <p className="text-xs text-muted-foreground">Generated from posted double-entry journal lines. Range: {reportRangeLabel}</p>
        </div>
        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profit & Loss</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="font-bold text-green-700">{formatCurrency(profitAndLoss?.totalIncome)}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="font-bold text-red-700">{formatCurrency(profitAndLoss?.totalExpenses)}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs text-muted-foreground">Net</p>
                <p className="font-bold text-blue-700">{formatCurrency(profitAndLoss?.netProfit)}</p>
              </div>
            </div>
            <ReportRows title="Income Accounts" rows={profitAndLoss?.income ?? []} empty="No posted income journal lines yet" formatCurrency={formatCurrency} />
            <ReportRows title="Expense Accounts" rows={profitAndLoss?.expenses ?? []} empty="No posted expense journal lines yet" formatCurrency={formatCurrency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Balance Sheet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs text-muted-foreground">Assets</p>
                <p className="font-bold text-blue-700">{formatCurrency(balanceSheet?.totalAssets)}</p>
              </div>
              <div className="rounded-lg bg-orange-50 p-3">
                <p className="text-xs text-muted-foreground">Liabilities</p>
                <p className="font-bold text-orange-700">{formatCurrency(balanceSheet?.totalLiabilities)}</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-3">
                <p className="text-xs text-muted-foreground">Equity</p>
                <p className="font-bold text-purple-700">{formatCurrency(balanceSheet?.totalEquity)}</p>
              </div>
            </div>
            <Badge variant={balanceSheet?.balanced ? 'default' : 'destructive'}>
              {balanceSheet?.balanced ? 'Balanced' : 'Out of balance'}
            </Badge>
            <ReportRows title="Assets" rows={balanceSheet?.assets ?? []} empty="No asset balances yet" formatCurrency={formatCurrency} />
            <ReportRows title="Liabilities" rows={balanceSheet?.liabilities ?? []} empty="No liability balances yet" formatCurrency={formatCurrency} />
            <ReportRows title="Equity" rows={balanceSheet?.equity ?? []} empty="No equity balances yet" formatCurrency={formatCurrency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">VAT Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Output VAT</span>
              <span className="font-semibold">{formatCurrency(vatSummary?.outputVat)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Input VAT</span>
              <span className="font-semibold">{formatCurrency(vatSummary?.inputVat)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-medium">Net VAT Payable</span>
              <span className="font-bold">{formatCurrency(vatSummary?.netVatPayable)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              VAT is calculated from posted invoices, bills, and expenses in the canonical accounting tables.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cash Flow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-xs text-muted-foreground">Inflows</p>
                <p className="font-bold text-green-700">{formatCurrency(cashFlow?.totalInflows)}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-xs text-muted-foreground">Outflows</p>
                <p className="font-bold text-red-700">{formatCurrency(cashFlow?.totalOutflows)}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs text-muted-foreground">Net</p>
                <p className="font-bold text-blue-700">{formatCurrency(cashFlow?.netCashFlow)}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Inflows</p>
              {(cashFlow?.inflows.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">No posted cash inflows yet</p>
              ) : cashFlow!.inflows.map((row) => (
                <div key={`in-${row.sourceType}`} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{formatCurrency(row.amount)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Outflows</p>
              {(cashFlow?.outflows.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">No posted cash outflows yet</p>
              ) : cashFlow!.outflows.map((row) => (
                <div key={`out-${row.sourceType}`} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{formatCurrency(row.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Chart of Accounts</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: 'Assets', data: assetAccounts },
                { label: 'Liabilities', data: liabilityAccounts },
                { label: 'Equity', data: equityAccounts },
                { label: 'Income', data: incomeAccounts },
                { label: 'Expenses', data: expenseAccounts },
              ].map((group) => (
                <div key={group.label} className="rounded-lg border p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{group.label}</p>
                  <div className="mt-2 space-y-1">
                    {group.data.map((account) => (
                      <p key={account.id} className="text-sm">{formatAccount(account)}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Journal Entries</CardTitle></CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No posted journal entries yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {entries.map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{entry.entryNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.sourceType.replace('_', ' ')} · {formatDate(entry.entryDate)} · {entry.status}
                        </p>
                        {entry.memo && <p className="text-xs mt-1">{entry.memo}</p>}
                      </div>
                      {entry.status === 'posted' && (
                        <Button size="sm" variant="outline" disabled={reversePending} onClick={() => onReverseJournalEntry(entry)}>
                          Reverse
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showOperationalSales && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Sales by Customer</CardTitle></CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={orders.slice(0, 10).map((order) => ({ name: order.customer_name, total: order.total }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} />
                  <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Sales by Admin</CardTitle></CardHeader>
          <CardContent>
            {salesByPersonData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={salesByPersonData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {salesByPersonData.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Sales by Item Type</CardTitle></CardHeader>
          <CardContent>
            {salesByItem.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No item data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={salesByItem}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'total' ? `KES ${Number(value).toLocaleString()}` : Number(value).toLocaleString(),
                      name === 'total' ? 'Amount' : 'Quantity',
                    ]}
                  />
                  <Bar dataKey="quantity" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
