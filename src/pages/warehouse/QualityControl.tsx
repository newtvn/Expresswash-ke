import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, EmptyState } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Package,
  Loader2,
  Timer,
} from 'lucide-react';
import { toast } from 'sonner';
import { getProcessingItems, performQualityCheck, updateItemStage } from '@/services/warehouseService';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { ProcessingItem } from '@/types';

const checklistItems = [
  { id: 'stains', label: 'All stains removed or treated' },
  { id: 'odor', label: 'No residual odors' },
  { id: 'color', label: 'Colors intact, no fading or bleeding' },
  { id: 'texture', label: 'Fabric texture restored' },
  { id: 'edges', label: 'Edges and seams intact' },
  { id: 'dryness', label: 'Completely dry to the touch' },
  { id: 'packaging', label: 'Ready for proper packaging' },
];

const QualityControl = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');

  const { data: qcItems = [], isLoading } = useQuery({
    queryKey: ['warehouse', 'processing', 'quality_check'],
    queryFn: () => getProcessingItems('quality_check'),
    refetchInterval: 30000,
  });

  // Auto-select first item if none selected
  const effectiveSelected = selectedItem && qcItems.find((i) => i.id === selectedItem)
    ? selectedItem
    : qcItems.length > 0 ? qcItems[0].id : null;

  const currentItem = qcItems.find((item) => item.id === effectiveSelected);

  const toggleCheck = (checkId: string) => {
    setChecklist((prev) => ({ ...prev, [checkId]: !prev[checkId] }));
  };

  const allChecked = checklistItems.every((item) => checklist[item.id]);
  const failedChecks = checklistItems.filter((item) => !checklist[item.id]).map((item) => item.label);

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!currentItem) throw new Error('No item selected');
      const result = await performQualityCheck(
        currentItem.id,
        true,
        notes || 'All checks passed',
        user?.name ?? 'QC Inspector',
      );
      if (!result.success) throw new Error('QC approval failed');

      // Update order status to quality_approved (9)
      await supabase
        .from('orders')
        .update({ status: 9, updated_at: new Date().toISOString() })
        .ilike('tracking_code', currentItem.orderNumber);
    },
    onSuccess: () => {
      toast.success(`${currentItem?.itemName} passed QC — moved to dispatch`);
      resetForm();
      qc.invalidateQueries({ queryKey: ['warehouse'] });
    },
    onError: (e) => toast.error('Approval failed: ' + e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!currentItem) throw new Error('No item selected');
      // Record failed QC
      await performQualityCheck(
        currentItem.id,
        false,
        notes || 'Failed inspection — sent back for re-processing',
        user?.name ?? 'QC Inspector',
        failedChecks,
      );
      // Move item back to washing stage
      await updateItemStage(currentItem.id, 'washing');

      // Update order status back to in_washing (6)
      await supabase
        .from('orders')
        .update({ status: 6, updated_at: new Date().toISOString() })
        .ilike('tracking_code', currentItem.orderNumber);
    },
    onSuccess: () => {
      toast.error(`${currentItem?.itemName} failed QC — sent back for re-processing`);
      resetForm();
      qc.invalidateQueries({ queryKey: ['warehouse'] });
    },
    onError: (e) => toast.error('Rejection failed: ' + e.message),
  });

  const resetForm = () => {
    setSelectedItem(null);
    setChecklist({});
    setNotes('');
  };

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quality Control"
        description="Inspect cleaned items before dispatch"
      />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : qcItems.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No items pending QC"
          description="All items have been inspected. Check back later."
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Item Queue */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                QC Queue ({qcItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {qcItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item.id);
                    setChecklist({});
                    setNotes('');
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    effectiveSelected === item.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border/50 hover:border-primary/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {item.itemName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.itemType} | {item.orderNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.customerName}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">{item.warehouseLocation}</Badge>
                      {item.daysInWarehouse > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 justify-end">
                          <Timer className={`h-3 w-3 ${item.daysInWarehouse > 3 ? 'text-red-500' : 'text-orange-500'}`} />
                          {item.daysInWarehouse}d
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* QC Checklist */}
          <div className="lg:col-span-2">
            {currentItem ? (
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold">
                        Inspecting: {currentItem.itemName}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentItem.itemType} | Order: {currentItem.orderNumber} |
                        Customer: {currentItem.customerName}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Checklist */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                      Inspection Checklist
                    </h4>
                    {checklistItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50"
                      >
                        <Checkbox
                          id={item.id}
                          checked={!!checklist[item.id]}
                          onCheckedChange={() => toggleCheck(item.id)}
                          disabled={isPending}
                        />
                        <Label
                          htmlFor={item.id}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {item.label}
                        </Label>
                        {checklist[item.id] ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Inspector Notes */}
                  <div className="space-y-2">
                    <Label>Inspector Notes</Label>
                    <Textarea
                      placeholder="Any observations, issues, or special notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      disabled={isPending}
                    />
                  </div>

                  {/* Progress indicator */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {Object.values(checklist).filter(Boolean).length} of{' '}
                      {checklistItems.length} checks completed
                    </span>
                    <div className="flex-1 bg-secondary rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{
                          width: `${
                            (Object.values(checklist).filter(Boolean).length /
                              checklistItems.length) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button onClick={() => approveMutation.mutate()} disabled={!allChecked || isPending} className="flex-1">
                      {approveMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Approve & Move to Dispatch
                    </Button>
                    <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={isPending} className="flex-1">
                      {rejectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Reject & Re-process
                    </Button>
                  </div>

                  {!allChecked && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      <AlertTriangle className="w-4 h-4" />
                      Complete all checklist items to approve this item
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                icon={Sparkles}
                title="Select an item"
                description="Choose an item from the queue to begin inspection"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityControl;
