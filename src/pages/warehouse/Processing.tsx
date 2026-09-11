import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, Paginator } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Droplets, Wind, CheckCircle, Clock, ArrowRight, Timer, Search } from 'lucide-react';
import { toast } from 'sonner';
import { getProcessingItemsPage, getWarehouseStats, updateItemStage } from '@/services/warehouseService';
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
  const [stage, setStage] = useState<ProcessingItem['stage']>('intake');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 20;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);
  useEffect(() => setPage(0), [stage, debouncedSearch]);

  const { data: processingPage, isLoading } = useQuery({
    queryKey: ['warehouse', 'processing', stage, page, debouncedSearch],
    queryFn: () => getProcessingItemsPage({ stage, page, pageSize, search: debouncedSearch }),
    refetchInterval: 30000,
    placeholderData: (previous) => previous,
  });
  const { data: stats } = useQuery({
    queryKey: ['warehouse', 'stats'],
    queryFn: getWarehouseStats,
    refetchInterval: 30000,
  });
  const items = processingPage?.rows ?? [];
  const itemTotal = processingPage?.total ?? 0;

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
      qc.invalidateQueries({ queryKey: ['warehouse', 'stats'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  function ProcessingTable({ stage: tableStage }: { stage: ProcessingItem['stage'] }) {
    const stageItems = items;
    const nextStage = NEXT_STAGE[tableStage];
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
    intake: stats ? Math.max(stats.totalItems - stats.inWashing - stats.inDrying - stats.inQualityCheck - stats.readyForDispatch, 0) : 0,
    washing: stats?.inWashing ?? 0,
    drying: stats?.inDrying ?? 0,
    quality_check: stats?.inQualityCheck ?? 0,
    ready: stats?.readyForDispatch ?? 0,
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
        <Tabs value={stage === 'ready_for_dispatch' ? 'ready' : stage} onValueChange={(value) => setStage(value === 'ready' ? 'ready_for_dispatch' : value as ProcessingItem['stage'])}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="intake">Intake ({stageCounts.intake})</TabsTrigger>
            <TabsTrigger value="washing">Washing ({stageCounts.washing})</TabsTrigger>
            <TabsTrigger value="drying">Drying ({stageCounts.drying})</TabsTrigger>
            <TabsTrigger value="quality_check">QC ({stageCounts.quality_check})</TabsTrigger>
            <TabsTrigger value="ready">Ready ({stageCounts.ready})</TabsTrigger>
          </TabsList>
          <div className="relative mt-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search processing items..." className="pl-9" />
          </div>
          <TabsContent value={stage === 'ready_for_dispatch' ? 'ready' : stage} className="mt-4 space-y-4">
            <ProcessingTable stage={stage} />
            <Paginator
              page={page}
              pageSize={pageSize}
              total={itemTotal}
              totalPages={Math.max(1, Math.ceil(itemTotal / pageSize))}
              onPageChange={setPage}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Processing;
