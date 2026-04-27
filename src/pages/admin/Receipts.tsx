import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Receipt, Plus, Search, Filter, Tag, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { DateRangePicker } from '@/components/shared/DateRangePicker';

type DateRange = { from: Date | undefined; to: Date | undefined };

// ---------- Types ----------

interface ReceiptRecord {
  id: string;
  vendor: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  tags: string[];
  notes?: string;
  reference_number?: string;
  created_at: string;
}

// ---------- Service helpers ----------

async function fetchReceipts(filters: { from?: string; to?: string; category?: string; tag?: string; search?: string }): Promise<ReceiptRecord[]> {
  let q = supabase.from('receipts').select('*').order('date', { ascending: false });
  if (filters.from) q = q.gte('date', filters.from);
  if (filters.to) q = q.lte('date', filters.to);
  if (filters.category && filters.category !== 'all') q = q.eq('category', filters.category);
  if (filters.search) q = q.ilike('description', `%${filters.search}%`);
  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    vendor: r.vendor as string,
    description: r.description as string,
    amount: r.amount as number,
    category: r.category as string,
    date: r.date as string,
    tags: (r.tags as string[]) ?? [],
    notes: (r.notes as string) ?? undefined,
    reference_number: (r.reference_number as string) ?? undefined,
    created_at: r.created_at as string,
  }));
}

async function createReceipt(payload: Omit<ReceiptRecord, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('receipts').insert({ ...payload, created_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

async function deleteReceipt(id: string): Promise<void> {
  const { error } = await supabase.from('receipts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- Constants ----------

const RECEIPT_CATEGORIES = [
  'Fuel', 'Supplies', 'Salary', 'Rent', 'Utilities', 'Maintenance', 'Marketing', 'Transport', 'Food', 'Other',
];

const CATEGORY_COLORS: Record<string, string> = {
  Fuel: 'bg-yellow-100 text-yellow-700',
  Supplies: 'bg-blue-100 text-blue-700',
  Salary: 'bg-green-100 text-green-700',
  Rent: 'bg-purple-100 text-purple-700',
  Utilities: 'bg-orange-100 text-orange-700',
  Maintenance: 'bg-red-100 text-red-700',
  Marketing: 'bg-pink-100 text-pink-700',
  Transport: 'bg-indigo-100 text-indigo-700',
  Food: 'bg-emerald-100 text-emerald-700',
  Other: 'bg-gray-100 text-gray-700',
};

// ---------- Component ----------

export const Receipts = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [tagFilter, setTagFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    vendor: '',
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    tags: '',
    notes: '',
    reference_number: '',
  });

  const queryFilters = {
    from: dateRange.from?.toISOString().split('T')[0],
    to: dateRange.to?.toISOString().split('T')[0],
    category: categoryFilter,
    tag: tagFilter || undefined,
    search: search || undefined,
  };

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['admin', 'receipts', queryFilters],
    queryFn: () => fetchReceipts(queryFilters),
    refetchInterval: 60000,
  });

  const createMutation = useMutation({
    mutationFn: createReceipt,
    onSuccess: () => {
      toast.success('Receipt saved');
      setAddOpen(false);
      setForm({ vendor: '', description: '', amount: '', category: '', date: new Date().toISOString().split('T')[0], tags: '', notes: '', reference_number: '' });
      qc.invalidateQueries({ queryKey: ['admin', 'receipts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReceipt,
    onSuccess: () => {
      toast.success('Receipt deleted');
      qc.invalidateQueries({ queryKey: ['admin', 'receipts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalAmount = receipts.reduce((s, r) => s + r.amount, 0);

  // Collect all unique tags for quick filter
  const allTags = Array.from(new Set(receipts.flatMap((r) => r.tags)));

  return (
    <div className="space-y-6">
      <PageHeader title="Receipts" description="Record and track all scanned receipts and expense documents">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Receipt
        </Button>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-muted-foreground">Total Receipts</p>
            <p className="text-2xl font-bold">{receipts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-muted-foreground">Total Amount</p>
            <p className="text-2xl font-bold">KES {totalAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-muted-foreground">Categories</p>
            <p className="text-2xl font-bold">{new Set(receipts.map((r) => r.category)).size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-muted-foreground">This Month</p>
            <p className="text-2xl font-bold">
              KES {receipts
                .filter((r) => new Date(r.date).getMonth() === new Date().getMonth())
                .reduce((s, r) => s + r.amount, 0)
                .toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 w-56" placeholder="Search receipts..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {RECEIPT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
        {allTags.length > 0 && (
          <Select value={tagFilter || 'all'} onValueChange={(v) => setTagFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Receipts list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading receipts...</p>
      ) : receipts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No receipts found</p>
            <p className="text-sm mt-1">Add your first receipt using the button above</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {receipts.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.vendor}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[r.category] ?? 'bg-gray-100 text-gray-700'}`}>
                      <Tag className="h-3 w-3" />
                      {r.category}
                    </span>
                    {r.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.description}
                    {r.reference_number && ` · Ref: ${r.reference_number}`}
                    {' · '}<Calendar className="h-3 w-3 inline-block" /> {new Date(r.date).toLocaleDateString()}
                  </p>
                  {r.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{r.notes}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm">KES {r.amount.toLocaleString()}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (window.confirm('Delete this receipt?')) deleteMutation.mutate(r.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-between p-3 font-semibold border-t">
            <span>{receipts.length} receipts shown</span>
            <span>KES {totalAmount.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Add Receipt Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Receipt</DialogTitle>
            <DialogDescription>Record a new expense receipt manually</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vendor / Supplier *</Label>
                <Input value={form.vendor} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} placeholder="e.g. Shell Kitengela" />
              </div>
              <div>
                <Label>Reference No.</Label>
                <Input value={form.reference_number} onChange={(e) => setForm((p) => ({ ...p, reference_number: e.target.value }))} placeholder="Receipt / invoice number" />
              </div>
            </div>
            <div>
              <Label>Description *</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What was purchased" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (KES) *</Label>
                <Input type="number" min="0" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {RECEIPT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="e.g. weekly, van1, operations" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Additional details..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              disabled={createMutation.isPending || !form.vendor || !form.description || !form.amount || !form.category}
              onClick={() =>
                createMutation.mutate({
                  vendor: form.vendor,
                  description: form.description,
                  amount: parseFloat(form.amount),
                  category: form.category,
                  date: form.date,
                  tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
                  notes: form.notes || undefined,
                  reference_number: form.reference_number || undefined,
                })
              }
            >
              {createMutation.isPending ? 'Saving...' : 'Save Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Receipts;
