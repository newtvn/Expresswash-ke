import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, KPICard, DataTable, StatusBadge, ConfirmDialog } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign, TrendingUp, TrendingDown, Percent, Plus, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/config/queryKeys';
import {
  getExpenses,
  createExpense,
  approveExpense,
  rejectExpense,
  getExpenseSummary,
  getExpenseKPIs,
  type Expense,
  type CreateExpensePayload,
} from '@/services/expenseService';

const EXPENSE_CATEGORIES = [
  'fuel',
  'supplies',
  'salary',
  'rent',
  'utilities',
  'marketing',
  'maintenance',
  'other',
];

const PAYMENT_METHODS = ['cash', 'mpesa', 'bank_transfer', 'card'];

const categoryColors = [
  'bg-primary',
  'bg-blue-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-gray-400',
  'bg-cyan-500',
  'bg-pink-500',
];

const expenseColumns: Column<Expense>[] = [
  {
    key: 'expenseDate',
    header: 'Date',
    sortable: true,
    render: (row) => new Date(row.expenseDate).toLocaleDateString('en-KE'),
  },
  {
    key: 'category',
    header: 'Category',
    sortable: true,
    render: (row) => (
      <span className="capitalize">{row.category.replace('_', ' ')}</span>
    ),
  },
  {
    key: 'description',
    header: 'Description',
    render: (row) => (
      <span className="text-sm truncate max-w-xs block">{row.description}</span>
    ),
  },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    render: (row) => <span className="font-medium">KES {row.amount.toLocaleString()}</span>,
  },
  {
    key: 'paymentMethod',
    header: 'Method',
    render: (row) => (
      <span className="capitalize text-sm">{row.paymentMethod.replace('_', ' ')}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
];

/**
 * Admin Profit & Expense Page
 * KPI summary, revenue vs expenses chart, expense breakdown, and expense CRUD.
 */
export const ProfitExpense = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);

  // Form state for new expense
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMethod, setFormMethod] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);

  // Queries
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: queryKeys.expenses.list({}),
    queryFn: () => getExpenses(),
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: queryKeys.expenses.kpis(),
    queryFn: () => getExpenseKPIs(),
  });

  const { data: summary = [], isLoading: summaryLoading } = useQuery({
    queryKey: queryKeys.expenses.summary(),
    queryFn: () => getExpenseSummary(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateExpensePayload) => createExpense(payload, user?.id ?? ''),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Expense added');
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
        setAddOpen(false);
        resetForm();
      } else {
        toast.error(result.error ?? 'Failed to add expense');
      }
    },
    onError: () => toast.error('Failed to add expense'),
  });

  const approveMutation = useMutation({
    mutationFn: (expenseId: string) => approveExpense(expenseId, user?.id ?? ''),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Expense approved');
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      } else {
        toast.error(result.error ?? 'Failed to approve expense');
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (expenseId: string) => rejectExpense(expenseId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Expense rejected');
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      } else {
        toast.error(result.error ?? 'Failed to reject expense');
      }
    },
  });

  const resetForm = () => {
    setFormCategory('');
    setFormDescription('');
    setFormAmount('');
    setFormMethod('');
    setFormDate(new Date().toISOString().split('T')[0]);
  };

  const handleAddExpense = () => {
    if (!formCategory || !formDescription || !formAmount || !formMethod) {
      toast.error('Please fill in all required fields');
      return;
    }
    createMutation.mutate({
      category: formCategory,
      description: formDescription,
      amount: parseFloat(formAmount),
      paymentMethod: formMethod,
      expenseDate: formDate,
    });
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.action === 'approve') {
      approveMutation.mutate(confirmAction.id);
    } else {
      rejectMutation.mutate(confirmAction.id);
    }
    setConfirmAction(null);
  };

  // KPI data
  const kpiCards = [
    {
      label: 'Total Revenue',
      value: kpis?.totalRevenue ?? 0,
      change: 0,
      changeDirection: 'flat' as const,
      icon: DollarSign,
      format: 'currency' as const,
    },
    {
      label: 'Total Expenses',
      value: kpis?.totalExpenses ?? 0,
      change: 0,
      changeDirection: 'flat' as const,
      icon: TrendingDown,
      format: 'currency' as const,
    },
    {
      label: 'Net Profit',
      value: kpis?.netProfit ?? 0,
      change: 0,
      changeDirection: 'flat' as const,
      icon: TrendingUp,
      format: 'currency' as const,
    },
    {
      label: 'Profit Margin',
      value: kpis?.profitMargin ?? 0,
      change: 0,
      changeDirection: 'flat' as const,
      icon: Percent,
      format: 'percentage' as const,
    },
  ];

  // Expense columns with actions
  const columnsWithActions: Column<Expense>[] = [
    ...expenseColumns,
    {
      key: 'id',
      header: 'Actions',
      render: (row) =>
        row.status === 'pending' ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => setConfirmAction({ id: row.id, action: 'approve' })}
            >
              <CheckCircle className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => setConfirmAction({ id: row.id, action: 'reject' })}
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Profit & Expenses" description="Financial overview and expense tracking">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </PageHeader>

      {/* Summary KPIs */}
      {kpisLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card border-border/50">
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <KPICard key={kpi.label} {...kpi} />
          ))}
        </div>
      )}

      {/* Expense Breakdown */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Expense Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : summary.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No approved expenses to display</p>
          ) : (
            <div className="space-y-4">
              {summary.map((item, index) => (
                <div key={item.category} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${categoryColors[index % categoryColors.length]}`} />
                      <span className="text-foreground font-medium capitalize">{item.category.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{item.percentage}%</span>
                      <span className="font-medium text-foreground w-28 text-right">
                        KES {item.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${categoryColors[index % categoryColors.length]} transition-all`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={expenses}
            columns={columnsWithActions}
            searchable
            searchPlaceholder="Search expenses..."
            pageSize={10}
          />
        </CardContent>
      </Card>

      {/* Add Expense Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category *</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <span className="capitalize">{cat.replace('_', ' ')}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What was this expense for?"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (KES) *</Label>
                <Input
                  type="number"
                  min="0"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Payment Method *</Label>
              <Select value={formMethod} onValueChange={setFormMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      <span className="capitalize">{m.replace('_', ' ')}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddExpense}
              disabled={createMutation.isPending || !formCategory || !formDescription || !formAmount || !formMethod}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm approve/reject dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={confirmAction?.action === 'approve' ? 'Approve Expense' : 'Reject Expense'}
        description={`Are you sure you want to ${confirmAction?.action} this expense?`}
        confirmLabel={confirmAction?.action === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
};

export default ProfitExpense;
