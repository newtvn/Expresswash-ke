import { PageHeader, DataTable, StatusBadge, KPICard } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Droplets, Wind, Sparkles, PackageCheck, AlertTriangle, RefreshCw, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const warehouseStats = [
  { label: 'Awaiting Wash', value: 18, change: 5, changeDirection: 'up' as const, icon: Package, format: 'number' as const },
  { label: 'In Washing', value: 24, change: -2, changeDirection: 'down' as const, icon: Droplets, format: 'number' as const },
  { label: 'Drying', value: 12, change: 0, changeDirection: 'flat' as const, icon: Wind, format: 'number' as const },
  { label: 'Quality Check', value: 8, change: 3, changeDirection: 'up' as const, icon: Sparkles, format: 'number' as const },
  { label: 'Ready to Dispatch', value: 15, change: -1, changeDirection: 'down' as const, icon: PackageCheck, format: 'number' as const },
  { label: 'Overdue Items', value: 3, change: 50, changeDirection: 'up' as const, icon: AlertTriangle, format: 'number' as const },
];

const mockStock = [
  { id: 'STK-001', item: 'Carpet Shampoo (5L)', category: 'Cleaning Supplies', inStock: 24, minLevel: 10, status: 'ok', lastRestocked: '2024-12-10' },
  { id: 'STK-002', item: 'Fabric Softener (5L)', category: 'Cleaning Supplies', inStock: 8, minLevel: 10, status: 'low', lastRestocked: '2024-12-05' },
  { id: 'STK-003', item: 'Stain Remover Spray', category: 'Cleaning Supplies', inStock: 45, minLevel: 20, status: 'ok', lastRestocked: '2024-12-12' },
  { id: 'STK-004', item: 'Washing Machine Pods', category: 'Consumables', inStock: 120, minLevel: 50, status: 'ok', lastRestocked: '2024-12-08' },
  { id: 'STK-005', item: 'Plastic Wrapping Roll', category: 'Packaging', inStock: 3, minLevel: 5, status: 'low', lastRestocked: '2024-11-28' },
  { id: 'STK-006', item: 'Garment Bags (Large)', category: 'Packaging', inStock: 200, minLevel: 100, status: 'ok', lastRestocked: '2024-12-01' },
  { id: 'STK-007', item: 'Drying Rack Clips', category: 'Equipment', inStock: 50, minLevel: 20, status: 'ok', lastRestocked: '2024-11-25' },
  { id: 'STK-008', item: 'Steam Iron Refills', category: 'Equipment', inStock: 2, minLevel: 5, status: 'low', lastRestocked: '2024-11-20' },
  { id: 'STK-009', item: 'Dust Masks (Box)', category: 'Safety', inStock: 15, minLevel: 5, status: 'ok', lastRestocked: '2024-12-06' },
  { id: 'STK-010', item: 'Latex Gloves (Box)', category: 'Safety', inStock: 4, minLevel: 10, status: 'low', lastRestocked: '2024-11-30' },
];

const mockItems = [
  { id: 'ITM-4001', orderId: 'EW-2024-01284', itemType: 'Carpet (Large)', stage: 'in_washing', location: 'Bay 3', daysInWarehouse: 1, isOverdue: false },
  { id: 'ITM-4002', orderId: 'EW-2024-01284', itemType: 'Carpet (Small)', stage: 'in_washing', location: 'Bay 3', daysInWarehouse: 1, isOverdue: false },
  { id: 'ITM-4003', orderId: 'EW-2024-01284', itemType: 'Sofa (2-Seater)', stage: 'in_washing', location: 'Bay 5', daysInWarehouse: 1, isOverdue: false },
  { id: 'ITM-4004', orderId: 'EW-2024-01283', itemType: 'Curtain Pair', stage: 'drying', location: 'Rack A', daysInWarehouse: 2, isOverdue: false },
  { id: 'ITM-4005', orderId: 'EW-2024-01282', itemType: 'Mattress', stage: 'quality_check', location: 'QC Zone', daysInWarehouse: 3, isOverdue: false },
  { id: 'ITM-4006', orderId: 'EW-2024-01279', itemType: 'Carpet (Large)', stage: 'ready_for_dispatch', location: 'Dispatch A', daysInWarehouse: 4, isOverdue: false },
  { id: 'ITM-4007', orderId: 'EW-2024-01275', itemType: 'Rug', stage: 'in_washing', location: 'Bay 2', daysInWarehouse: 5, isOverdue: true },
  { id: 'ITM-4008', orderId: 'EW-2024-01270', itemType: 'Sofa (3-Seater)', stage: 'drying', location: 'Rack C', daysInWarehouse: 7, isOverdue: true },
];

const stockColumns: Column<(typeof mockStock)[0]>[] = [
  { key: 'item', header: 'Item', sortable: true },
  { key: 'category', header: 'Category', sortable: true },
  {
    key: 'inStock',
    header: 'In Stock',
    sortable: true,
    render: (row) => (
      <span className={cn('font-medium', row.status === 'low' && 'text-red-600 font-bold')}>
        {row.inStock}
      </span>
    ),
  },
  { key: 'minLevel', header: 'Min Level' },
  {
    key: 'status',
    header: 'Status',
    render: (row) =>
      row.status === 'low' ? (
        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Low Stock
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
          OK
        </Badge>
      ),
  },
  { key: 'lastRestocked', header: 'Last Restocked', sortable: true },
  {
    key: 'id',
    header: 'Action',
    render: (row) => (
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.success(`Restock request sent for ${row.item}`)}
      >
        <RefreshCw className="w-3 h-3 mr-1" />
        Restock
      </Button>
    ),
  },
];

const itemColumns: Column<(typeof mockItems)[0]>[] = [
  { key: 'id', header: 'Item ID', sortable: true },
  { key: 'orderId', header: 'Order', sortable: true },
  { key: 'itemType', header: 'Item Type', sortable: true },
  { key: 'stage', header: 'Stage', render: (row) => <StatusBadge status={row.stage} /> },
  { key: 'location', header: 'Location' },
  {
    key: 'daysInWarehouse',
    header: 'Days In',
    sortable: true,
    render: (row) => (
      <span className={cn('font-medium', row.isOverdue && 'text-red-500')}>
        {row.daysInWarehouse}d
      </span>
    ),
  },
];

/**
 * Admin Inventory Page
 * Stock management with low stock alerts + warehouse item pipeline tracking.
 */
export const Inventory = () => {
  const lowStockCount = mockStock.filter((i) => i.status === 'low').length;

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Management" description="Track stock levels and warehouse pipeline">
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </PageHeader>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {warehouseStats.map((stat) => (
          <KPICard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">
            {lowStockCount} item{lowStockCount > 1 ? 's' : ''} below minimum stock level
          </span>
        </div>
      )}

      {/* Stock Table */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Stock Levels</h3>
          <DataTable data={mockStock} columns={stockColumns} searchPlaceholder="Search stock..." />
        </CardContent>
      </Card>

      {/* Warehouse Items Table */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Warehouse Pipeline</h3>
          <DataTable data={mockItems} columns={itemColumns} searchPlaceholder="Search items..." />
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventory;
