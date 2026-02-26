import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllPromotions, createPromotion, updatePromotion, togglePromotionActive,
  type Promotion, type PromotionInput,
} from '@/services/promotionService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Copy, Gift, Percent, Tag } from 'lucide-react';
import { toast } from 'sonner';

export function PromotionManagement() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['admin-promotions'],
    queryFn: getAllPromotions,
  });

  const createMutation = useMutation({
    mutationFn: createPromotion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      toast.success('Promotion created');
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PromotionInput> }) =>
      updatePromotion(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      toast.success('Promotion updated');
      setDialogOpen(false);
      setEditingPromo(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      togglePromotionActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-promotions'] }),
    onError: (err: Error) => toast.error(`Failed to toggle promotion: ${err.message}`),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const input: PromotionInput = {
      name: form.get('name') as string,
      description: (form.get('description') as string) || undefined,
      code: form.get('code') as string,
      discount_type: form.get('discount_type') as 'percentage' | 'fixed_amount',
      discount_value: Number(form.get('discount_value')),
      min_order_amount: form.get('min_order_amount')
        ? Number(form.get('min_order_amount')) : null,
      max_discount_amount: form.get('max_discount_amount')
        ? Number(form.get('max_discount_amount')) : null,
      usage_limit: form.get('usage_limit')
        ? Number(form.get('usage_limit')) : null,
      usage_per_customer: Number(form.get('usage_per_customer')) || 1,
      valid_from: (form.get('valid_from') as string) + 'T00:00:00Z',
      valid_until: (form.get('valid_until') as string) + 'T23:59:59Z',
      promotion_type: 'manual',
    };

    if (editingPromo) {
      updateMutation.mutate({ id: editingPromo.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success(`Copied: ${code}`);
  }

  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Promotion Codes</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage discount codes for customers
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPromo(null);
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> New Promotion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingPromo ? 'Edit Promotion' : 'Create Promotion'}
              </DialogTitle>
            </DialogHeader>
            <PromotionForm
              promo={editingPromo}
              onSubmit={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading promotions...</p>
      ) : promotions.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Tag className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No promotions yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create your first promotion code to get started
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Valid Period</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.map((promo) => {
              const isExpired = new Date(promo.valid_until) < now;
              const isExhausted = promo.usage_limit !== null && promo.times_used >= promo.usage_limit;

              return (
                <TableRow key={promo.id} className={isExpired ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">{promo.name}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => copyCode(promo.code)}
                      className="font-mono text-sm bg-muted px-2 py-0.5 rounded hover:bg-muted/80 inline-flex items-center gap-1"
                    >
                      {promo.code} <Copy className="h-3 w-3" />
                    </button>
                  </TableCell>
                  <TableCell>
                    {promo.discount_type === 'percentage' ? (
                      <span className="inline-flex items-center gap-1">
                        <Percent className="h-3 w-3" /> {promo.discount_value}%
                      </span>
                    ) : (
                      <span>KES {promo.discount_value.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {promo.times_used}{promo.usage_limit ? ` / ${promo.usage_limit}` : ''}
                    {isExhausted && <Badge variant="destructive" className="ml-1 text-xs">Full</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(promo.valid_from).toLocaleDateString()} {'\u2014'}{' '}
                    {new Date(promo.valid_until).toLocaleDateString()}
                    {isExpired && <Badge variant="outline" className="ml-1 text-xs">Expired</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {promo.promotion_type === 'birthday' && <Gift className="h-3 w-3 mr-1" />}
                      {promo.promotion_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={promo.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: promo.id, active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm"
                      onClick={() => { setEditingPromo(promo); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function PromotionForm({
  promo,
  onSubmit,
  loading,
}: {
  promo: Promotion | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
}) {
  const [discountType, setDiscountType] = useState(promo?.discount_type || 'percentage');

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Promotion Name</Label>
          <Input id="name" name="name" defaultValue={promo?.name || ''} required
            placeholder="e.g. Rainy Season Sale" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Promo Code</Label>
          <Input id="code" name="code"
            defaultValue={promo?.code || ''}
            required placeholder="e.g. RAINY20"
            className="font-mono uppercase"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={2}
          defaultValue={promo?.description || ''}
          placeholder="Internal notes about this promotion" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Discount Type</Label>
          <Select name="discount_type" defaultValue={discountType} onValueChange={setDiscountType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="fixed_amount">Fixed Amount (KES)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="discount_value">
            {discountType === 'percentage' ? 'Discount %' : 'Discount Amount (KES)'}
          </Label>
          <Input id="discount_value" name="discount_value" type="number" required
            defaultValue={promo?.discount_value || ''}
            min={0} max={discountType === 'percentage' ? 100 : undefined}
            placeholder={discountType === 'percentage' ? '20' : '500'} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="min_order_amount">Min Order (KES, optional)</Label>
          <Input id="min_order_amount" name="min_order_amount" type="number"
            defaultValue={promo?.min_order_amount || ''} min={0}
            placeholder="No minimum" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max_discount_amount">Max Discount Cap (KES, optional)</Label>
          <Input id="max_discount_amount" name="max_discount_amount" type="number"
            defaultValue={promo?.max_discount_amount || ''} min={0}
            placeholder="No cap" />
          <p className="text-xs text-muted-foreground">For % discounts — cap the maximum savings</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="usage_limit">Total Usage Limit (optional)</Label>
          <Input id="usage_limit" name="usage_limit" type="number"
            defaultValue={promo?.usage_limit || ''} min={1}
            placeholder="Unlimited" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="usage_per_customer">Uses Per Customer</Label>
          <Input id="usage_per_customer" name="usage_per_customer" type="number"
            defaultValue={promo?.usage_per_customer || 1} min={1} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="valid_from">Valid From</Label>
          <Input id="valid_from" name="valid_from" type="date" required
            defaultValue={promo ? promo.valid_from.split('T')[0] : new Date().toISOString().split('T')[0]} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valid_until">Valid Until</Label>
          <Input id="valid_until" name="valid_until" type="date" required
            defaultValue={promo?.valid_until.split('T')[0] || ''} />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Saving...' : promo ? 'Update Promotion' : 'Create Promotion'}
      </Button>
    </form>
  );
}
