import { useState, useEffect, useCallback } from 'react';
import { PageHeader, DataTable, StatusBadge, KPICard } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Droplets, Wind, Sparkles, PackageCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getWarehouseStats, getProcessingItems } from '@/services/warehouseService';
import type { WarehouseStats, ProcessingItem } from '@/types';

const humanizeValue = (value?: string) => value
  ? value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  : '—';

const itemColumns: Column<ProcessingItem>[] = [
  { key: 'id', header: 'Item ID', sortable: true, render: (row) => <span className="font-mono text-xs" title={row.id}>{row.id.slice(0, 8).toUpperCase()}</span> },
  { key: 'orderNumber', header: 'Order', sortable: true },
  { key: 'customerName', header: 'Customer', sortable: true },
  { key: 'itemName', header: 'Item Name', sortable: true, render: (row) => humanizeValue(row.itemName) },
  { key: 'itemType', header: 'Item Type', sortable: true, render: (row) => humanizeValue(row.itemType) },
  { key: 'stage', header: 'Stage', render: (row) => <StatusBadge status={row.stage} /> },
  { key: 'warehouseLocation', header: 'Location', render: (row) => humanizeValue(row.warehouseLocation) },
  {
    key: 'daysInWarehouse',
    header: 'Days In',
    sortable: true,
    render: (row) => (
      <span className={cn('font-medium', row.daysInWarehouse >= 5 && 'text-red-500')}>
        {row.daysInWarehouse} {row.daysInWarehouse === 1 ? 'day' : 'days'}
      </span>
    ),
  },
];

// ── Loading Skeletons ───────────────────────────────────────────────────

function KPISkeletons() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-12" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-28 mt-3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────

/**
 * Admin Inventory Page
 * Warehouse item pipeline tracking.
 * KPIs and warehouse pipeline items are fetched from Supabase.
 */
export const Inventory = () => {
  const [stats, setStats] = useState<WarehouseStats | null>(null);
  const [items, setItems] = useState<ProcessingItem[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getWarehouseStats();
      setStats(data);
    } catch {
      toast.error('Failed to load warehouse stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const data = await getProcessingItems();
      setItems(data);
    } catch {
      toast.error('Failed to load warehouse items');
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchItems();
  }, [fetchStats, fetchItems]);

  // Build KPI cards from live stats
  const warehouseKPIs = stats
    ? [
        { label: 'Total Items', value: stats.totalItems, icon: Package, format: 'number' as const },
        { label: 'In Washing', value: stats.inWashing, icon: Droplets, format: 'number' as const },
        { label: 'Drying', value: stats.inDrying, icon: Wind, format: 'number' as const },
        { label: 'Quality Check', value: stats.inQualityCheck, icon: Sparkles, format: 'number' as const },
        { label: 'Ready to Dispatch', value: stats.readyForDispatch, icon: PackageCheck, format: 'number' as const },
        { label: 'Overdue Items', value: stats.overdueItems, icon: AlertTriangle, format: 'number' as const },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Management" description="Track every customer item through the warehouse pipeline" />

      {/* Pipeline Stats */}
      {statsLoading ? (
        <KPISkeletons />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {warehouseKPIs.map((stat) => (
            <KPICard key={stat.label} {...stat} />
          ))}
        </div>
      )}

      {/* Capacity Bar */}
      {!statsLoading && stats && (
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Warehouse Capacity</span>
              <span className="text-sm font-medium">
                {stats.capacityUsed} / {stats.capacityTotal} items
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  stats.capacityUsed / stats.capacityTotal > 0.9
                    ? 'bg-red-500'
                    : stats.capacityUsed / stats.capacityTotal > 0.7
                    ? 'bg-amber-500'
                    : 'bg-emerald-500',
                )}
                style={{ width: `${Math.min((stats.capacityUsed / stats.capacityTotal) * 100, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warehouse Items Table (real data) */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Warehouse Pipeline</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchItems();
                fetchStats();
                toast.success('Refreshing warehouse data...');
              }}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>
          {itemsLoading ? (
            <TableSkeleton rows={6} />
          ) : items.length === 0 ? (
            <div className="text-center py-10">
              <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No items in the warehouse pipeline</p>
            </div>
          ) : (
            <DataTable data={items} columns={itemColumns} searchPlaceholder="Search items..." />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventory;
