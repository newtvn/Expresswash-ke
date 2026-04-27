import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle, Plus, Download,
  FileText, Users, Package, User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { useAuthStore } from '@/stores/authStore';

type DateRange = { from: Date | undefined; to: Date | undefined };

// ---------- Service helpers ----------

async function fetchAccountSummary() {
  const [ordersRes, paymentsRes, expensesRes] = await Promise.all([
    supabase.from('orders').select('total, status, created_at'),
    supabase.from('payments').select('amount, status, created_at, payment_method'),
    supabase.from('expenses').select('amount, category, date, description, id'),
  ]);

  const orders = ordersRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  const totalRevenue = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + (p.amount ?? 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalReceivable = orders
    .filter((o) => o.status !== 13 && o.status !== 14)
    .reduce((s, o) => s + (o.total ?? 0), 0);
  const outstanding = totalReceivable - (payments.filter((p) => p.status === 'completed').reduce((s, p) => s + (p.amount ?? 0), 0));

  return { totalRevenue, totalExpenses, outstanding, netProfit: totalRevenue - totalExpenses, payments, expenses, orders };
}

async function fetchExpenses() {
  const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false });
  return data ?? [];
}

async function fetchPaymentsReceived(from?: string, to?: string) {
  let q = supabase.from('payments').select('*').eq('status', 'completed').order('created_at', { ascending: false });
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to + 'T23:59:59');
  const { data } = await q;
  return data ?? [];
}

async function fetchAgingSummary() {
  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, customer_name, total, paid_amount, due_date, status, created_at')
    .neq('status', 'paid');
  return data ?? [];
}

async function addExpense(payload: {
  description: string; category: string; amount: number; date: string; notes?: string;
}) {
  const { error } = await supabase.from('expenses').insert(payload);
  if (error) throw new Error(error.message);
}

async function addJournalEntry(payload: {
  entry_type: string; account: string; debit: number; credit: number; description: string; date: string;
}) {
  const { error } = await supabase.from('journal_entries').insert(payload);
  if (error) throw new Error(error.message);
}

const EXPENSE_CATEGORIES = [
  'Salary', 'Rent', 'Utilities', 'Transport', 'Equipment', 'Marketing', 'Cleaning Supplies', 'Other',
];

const CHART_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed'];

// ---------- Component ----------

export const Accounts = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [agingView, setAgingView] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [addJournalOpen, setAddJournalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', category: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [journalForm, setJournalForm] = useState({ entry_type: 'debit', account: '', debit: '', credit: '', description: '', date: new Date().toISOString().split('T')[0] });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['accounts', 'summary'],
    queryFn: fetchAccountSummary,
    refetchInterval: 60000,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['accounts', 'expenses'],
    queryFn: fetchExpenses,
  });

  const { data: paymentsReceived = [] } = useQuery({
    queryKey: ['accounts', 'payments', dateRange.from?.toISOString().split('T')[0], dateRange.to?.toISOString().split('T')[0]],
    queryFn: () => fetchPaymentsReceived(
      dateRange.from?.toISOString().split('T')[0],
      dateRange.to?.toISOString().split('T')[0],
    ),
  });

  const { data: agingData = [] } = useQuery({
    queryKey: ['accounts', 'aging'],
    queryFn: fetchAgingSummary,
  });

  const addExpenseMutation = useMutation({
    mutationFn: addExpense,
    onSuccess: () => {
      toast.success('Expense added');
      setAddExpenseOpen(false);
      setExpenseForm({ description: '', category: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addJournalMutation = useMutation({
    mutationFn: addJournalEntry,
    onSuccess: () => {
      toast.success('Journal entry added');
      setAddJournalOpen(false);
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Aging buckets
  const now = new Date();
  const agingBuckets = {
    current: agingData.filter((i) => {
      const days = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
      return days <= 0;
    }),
    '1_30': agingData.filter((i) => {
      const d = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
      return d > 0 && d <= 30;
    }),
    '31_60': agingData.filter((i) => {
      const d = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
      return d > 30 && d <= 60;
    }),
    '61_90': agingData.filter((i) => {
      const d = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
      return d > 60 && d <= 90;
    }),
    over_90: agingData.filter((i) => {
      const d = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
      return d > 90;
    }),
  };

  // Sales by person chart data (from payments)
  const salesByPerson = (summary?.payments ?? [])
    .filter((p) => p.status === 'completed' && p.created_by)
    .reduce((acc: Record<string, number>, p) => {
      const key = p.created_by ?? 'Unknown';
      acc[key] = (acc[key] ?? 0) + (p.amount ?? 0);
      return acc;
    }, {});

  const salesByPersonData = Object.entries(salesByPerson).map(([name, total]) => ({ name, total }));

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts" description="Financial overview, reports, and expense management">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddExpenseOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Expense
          </Button>
          <Button variant="outline" onClick={() => setAddJournalOpen(true)}>
            <FileText className="w-4 h-4 mr-2" /> Journal Entry
          </Button>
        </div>
      </PageHeader>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: summary?.totalRevenue ?? 0, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Expenses', value: summary?.totalExpenses ?? 0, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Net Profit', value: summary?.netProfit ?? 0, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Outstanding', value: summary?.outstanding ?? 0, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="py-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${kpi.bg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-bold">KES {(kpi.value).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="reports">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="expenses">Purchases & Expenses</TabsTrigger>
          <TabsTrigger value="payments">Payments Received</TabsTrigger>
          <TabsTrigger value="aging">Aging Summary</TabsTrigger>
          <TabsTrigger value="payables">Payables & Bills</TabsTrigger>
        </TabsList>

        {/* ---- REPORTS ---- */}
        <TabsContent value="reports" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm text-muted-foreground">
            {[
              { title: 'Balance Sheet', desc: 'Assets, liabilities, and equity snapshot' },
              { title: 'Profit & Loss', desc: 'Revenue vs expenses over a period' },
              { title: 'Cash Flow Statement', desc: 'Operating, investing, and financing flows' },
            ].map((r) => (
              <Card key={r.title} className="cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="py-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{r.title}</p>
                    <p className="text-xs mt-1">{r.desc}</p>
                  </div>
                  <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales by Customer */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Sales by Customer</CardTitle></CardHeader>
              <CardContent>
                {(summary?.orders ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={(summary?.orders ?? []).slice(0, 10).map((o) => ({ name: o.customer_name, total: o.total }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => `KES ${Number(v).toLocaleString()}`} />
                      <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Sales by Person */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Sales by Admin</CardTitle></CardHeader>
              <CardContent>
                {salesByPersonData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={salesByPersonData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {salesByPersonData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Legend />
                      <Tooltip formatter={(v) => `KES ${Number(v).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Sales by Item */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Sales by Item Type</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">Connect to order_items for item-level breakdown</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- EXPENSES ---- */}
        <TabsContent value="expenses" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Purchases & Expenses</CardTitle>
              <Button size="sm" onClick={() => setAddExpenseOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No expenses recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {expenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{e.description}</p>
                        <p className="text-xs text-muted-foreground">{e.category} · {e.date}</p>
                      </div>
                      <span className="font-semibold text-red-600">KES {Number(e.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- PAYMENTS RECEIVED ---- */}
        <TabsContent value="payments" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Export</Button>
          </div>
          <Card>
            <CardContent className="pt-4">
              {paymentsReceived.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No payments in selected period</p>
              ) : (
                <div className="space-y-2">
                  {paymentsReceived.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{p.customer_name ?? 'Customer'}</p>
                        <p className="text-xs text-muted-foreground">{p.payment_method ?? 'M-Pesa'} · {new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="font-semibold text-green-600">KES {Number(p.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 border-t font-semibold">
                    <span>Total Received</span>
                    <span className="text-green-600">KES {paymentsReceived.reduce((s, p) => s + (p.amount ?? 0), 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- AGING SUMMARY ---- */}
        <TabsContent value="aging" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Select value={agingView} onValueChange={(v) => setAgingView(v as typeof agingView)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Current', data: agingBuckets.current, color: 'text-green-600' },
              { label: '1–30 days', data: agingBuckets['1_30'], color: 'text-yellow-600' },
              { label: '31–60 days', data: agingBuckets['31_60'], color: 'text-orange-600' },
              { label: '61–90 days', data: agingBuckets['61_90'], color: 'text-red-500' },
              { label: '90+ days', data: agingBuckets.over_90, color: 'text-red-700' },
            ].map((bucket) => (
              <Card key={bucket.label}>
                <CardContent className="py-4 text-center">
                  <p className="text-xs text-muted-foreground">{bucket.label}</p>
                  <p className={`text-2xl font-bold ${bucket.color}`}>{bucket.data.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    KES {bucket.data.reduce((s, i) => s + ((i.total ?? 0) - (i.paid_amount ?? 0)), 0).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Overdue Invoice Detail</CardTitle></CardHeader>
            <CardContent>
              {agingData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No overdue invoices</p>
              ) : (
                <div className="space-y-2">
                  {agingData.map((inv) => {
                    const daysOverdue = Math.max(0, Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / 86400000));
                    const balance = (inv.total ?? 0) - (inv.paid_amount ?? 0);
                    return (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">{inv.invoice_number} — {inv.customer_name}</p>
                          <p className="text-xs text-muted-foreground">Due: {new Date(inv.due_date).toLocaleDateString()} · {daysOverdue} days overdue</p>
                        </div>
                        <span className="font-semibold text-red-600">KES {balance.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- PAYABLES & BILLS ---- */}
        <TabsContent value="payables" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Overdue Bills & Payables</CardTitle>
              <Button size="sm" onClick={() => setAddExpenseOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Bill
              </Button>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No bills recorded</p>
              ) : (
                <div className="space-y-2">
                  {expenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{e.description}</p>
                        <p className="text-xs text-muted-foreground">{e.category} · {e.date}</p>
                      </div>
                      <span className="font-semibold">KES {Number(e.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total Payables</span>
                    <span>KES {expenses.reduce((s, e) => s + (e.amount ?? 0), 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Expense Dialog */}
      <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense / Bill</DialogTitle>
            <DialogDescription>Record a new expense or bill manually</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Description *</Label>
                <Input value={expenseForm.description} onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))} placeholder="e.g. Driver salary" />
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (KES) *</Label>
                <Input type="number" min="0" value={expenseForm.amount} onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label>Date *</Label>
                <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={expenseForm.notes} onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Optional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddExpenseOpen(false)}>Cancel</Button>
            <Button
              disabled={addExpenseMutation.isPending}
              onClick={() => {
                if (!expenseForm.description || !expenseForm.category || !expenseForm.amount) {
                  toast.error('Please fill all required fields');
                  return;
                }
                addExpenseMutation.mutate({
                  description: expenseForm.description,
                  category: expenseForm.category,
                  amount: parseFloat(expenseForm.amount),
                  date: expenseForm.date,
                  notes: expenseForm.notes || undefined,
                });
              }}
            >
              {addExpenseMutation.isPending ? 'Saving...' : 'Save Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Journal Entry Dialog */}
      <Dialog open={addJournalOpen} onOpenChange={setAddJournalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Journal Entry</DialogTitle>
            <DialogDescription>Manual accounting entry for balance sheet / P&L adjustments</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Entry Type</Label>
                <Select value={journalForm.entry_type} onValueChange={(v) => setJournalForm((p) => ({ ...p, entry_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Account</Label>
                <Input value={journalForm.account} onChange={(e) => setJournalForm((p) => ({ ...p, account: e.target.value }))} placeholder="e.g. Cash, Revenue, Salary" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Debit (KES)</Label>
                <Input type="number" min="0" value={journalForm.debit} onChange={(e) => setJournalForm((p) => ({ ...p, debit: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label>Credit (KES)</Label>
                <Input type="number" min="0" value={journalForm.credit} onChange={(e) => setJournalForm((p) => ({ ...p, credit: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Description</Label>
                <Input value={journalForm.description} onChange={(e) => setJournalForm((p) => ({ ...p, description: e.target.value }))} placeholder="Entry description" />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={journalForm.date} onChange={(e) => setJournalForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddJournalOpen(false)}>Cancel</Button>
            <Button
              disabled={addJournalMutation.isPending}
              onClick={() => {
                addJournalMutation.mutate({
                  entry_type: journalForm.entry_type,
                  account: journalForm.account,
                  debit: parseFloat(journalForm.debit) || 0,
                  credit: parseFloat(journalForm.credit) || 0,
                  description: journalForm.description,
                  date: journalForm.date,
                });
              }}
            >
              {addJournalMutation.isPending ? 'Saving...' : 'Save Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Accounts;
