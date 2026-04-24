import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Droplets, Wind, CheckCircle, Clock, Play, ArrowRight, Timer, User } from 'lucide-react';
import { toast } from 'sonner';
import { getProcessingItems, updateItemStage } from '@/services/warehouseService';
import { updateOrderStatus } from '@/services/orderService';
import { ProcessingItem } from '@/types';
import { supabase } from '@/lib/supabase';

const STAGE_STATUS_MAP: Record<ProcessingItem['stage'], number> = {
  intake: 4,
  washing: 6,
  drying: 7,
  quality_check: 8,
  ready_for_dispatch: 9,
};

const NEXT_STAGE: Record<ProcessingItem['stage'], ProcessingItem['stage'] | null> = {
  intake: 'washing',
  washing: 'drying',
  drying: 'quality_check',
  quality_check: null, // handled by QC tab with checklist
  ready_for_dispatch: null,
};

export const Processing = () => {
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['warehouse', 'processing'],
    queryFn: () => getProcessingItems(),
    refetchInterval: 30000,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ itemId, currentStage, orderNumber }: { itemId: string; currentStage: ProcessingItem['stage']; orderNumber: string }) => {
      const nextStage = NEXT_STAGE[currentStage];
      if (!nextStage) throw new Error('Already at final stage');
      await updateItemStage(itemId, nextStage);
      // Update order status in orders table
      const newStatus = STAGE_STATUS_MAP[nextStage];
      await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).ilike('tracking_code', orderNumber);
    },
    onSuccess: () => {
      toast.success('Item moved to next stage');
      qc.invalidateQueries({ queryKey: ['warehouse', 'processing'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const byStage = (stage: ProcessingItem['stage']) => items.filter((i) => i.stage === stage);

  function ProcessingTable({ stage }: { stage: ProcessingItem['stage'] }) {
    const stageItems = byStage(stage);
    const nextStage = NEXT_STAGE[stage];
    return (
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Order #</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Days In</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stageItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No items in this stage</TableCell>
              </TableRow>
            ) : (
              stageItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.orderNumber}</TableCell>
                  <TableCell>{item.itemName}</TableCell>
                  <TableCell><Badge variant="outline">{item.itemType}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.warehouseLocation}</TableCell>
                  <TableCell>
                    {item.daysInWarehouse > 0 && (
                      <div className="flex items-center gap-1 text-sm">
                        <Timer className={`h-3 w-3 ${item.daysInWarehouse > 3 ? 'text-red-500' : 'text-orange-500'}`} />
                        <span className={item.daysInWarehouse > 3 ? 'text-red-600 font-medium' : ''}>{item.daysInWarehouse}d</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {nextStage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moveMutation.mutate({ itemId: item.id, currentStage: item.stage, orderNumber: item.orderNumber })}
                        disabled={moveMutation.isPending}
                      >
                        <ArrowRight className="mr-1 h-3 w-3" />
                        {nextStage === 'washing' ? 'Start Washing' : nextStage === 'drying' ? 'Move to Dry' : 'Send to QC'}
                      </Button>
                    ) : item.stage === 'quality_check' ? (
                      <Badge className="bg-orange-100 text-orange-800">Pending QC Tab</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" />Ready</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  const stageCounts = {
    intake: byStage('intake').length,
    washing: byStage('washing').length,
    drying: byStage('drying').length,
    quality_check: byStage('quality_check').length,
    ready: byStage('ready_for_dispatch').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Processing" description="Track items through warehouse stages — changes sync to order tracking" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Intake', count: stageCounts.intake, icon: Clock, color: 'yellow' },
          { label: 'Washing', count: stageCounts.washing, icon: Droplets, color: 'blue' },
          { label: 'Drying', count: stageCounts.drying, icon: Wind, color: 'sky' },
          { label: 'QC', count: stageCounts.quality_check, icon: CheckCircle, color: 'orange' },
          { label: 'Ready', count: stageCounts.ready, icon: CheckCircle, color: 'green' },
        ].map(({ label, count, icon: Icon, color }) => (
          <Card key={label} className={`bg-${color}-50 border-${color}-200`}>
            <CardContent className="py-4 text-center">
              <Icon className={`h-6 w-6 text-${color}-600 mx-auto mb-1`} />
              <p className={`text-2xl font-bold text-${color}-800`}>{count}</p>
              <p className={`text-xs text-${color}-600`}>{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <Tabs defaultValue="intake">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="intake">Intake ({stageCounts.intake})</TabsTrigger>
            <TabsTrigger value="washing">Washing ({stageCounts.washing})</TabsTrigger>
            <TabsTrigger value="drying">Drying ({stageCounts.drying})</TabsTrigger>
            <TabsTrigger value="quality_check">QC ({stageCounts.quality_check})</TabsTrigger>
            <TabsTrigger value="ready">Ready ({stageCounts.ready})</TabsTrigger>
          </TabsList>
          {(['intake', 'washing', 'drying', 'quality_check', 'ready_for_dispatch'] as ProcessingItem['stage'][]).map((stage, i) => (
            <TabsContent key={stage} value={stage === 'ready_for_dispatch' ? 'ready' : stage} className="mt-4">
              <ProcessingTable stage={stage} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

export default Processing;
