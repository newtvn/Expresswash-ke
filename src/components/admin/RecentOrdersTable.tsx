import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { ORDER_STAGES } from '@/config/constants';
import type { Order } from '@/types';

interface RecentOrdersTableProps {
  orders: (Order & { amount?: number })[];
}

const getStatusLabel = (statusNumber: number): string => {
  const stage = ORDER_STAGES.find((s) => s.id === statusNumber);
  if (!stage) return 'pending';
  return stage.name.toLowerCase().replace(/\s+/g, '_');
};

const getServiceSummary = (items: { name: string; quantity: number }[]): string => {
  if (!items || items.length === 0) return '-';
  if (items.length === 1) return items[0].name;
  return `${items[0].name} +${items.length - 1} more`;
};

export const RecentOrdersTable = ({ orders }: RecentOrdersTableProps) => {
  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            No recent orders
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayOrders = orders.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Orders</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayOrders.map((order) => (
              <TableRow key={order.trackingCode}>
                <TableCell className="font-medium text-sm">
                  {order.trackingCode}
                </TableCell>
                <TableCell className="text-sm">{order.customerName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {getServiceSummary(order.items)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={getStatusLabel(order.status)} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(order.pickupDate)}
                </TableCell>
                <TableCell className="text-sm text-right font-medium">
                  {order.amount != null ? formatCurrency(order.amount) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
