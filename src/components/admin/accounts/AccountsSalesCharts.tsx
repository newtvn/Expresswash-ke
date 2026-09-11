import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { Package, User, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type SalesOrderRow = { total: number | string; customer_name?: string };
type SalesByPersonRow = { name: string; total: number };
type SalesByItemRow = { name: string; quantity: number; total: number };

const CHART_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed'];

interface AccountsSalesChartsProps {
  orders: SalesOrderRow[];
  salesByPersonData: SalesByPersonRow[];
  salesByItem: SalesByItemRow[];
}

/**
 * Operational sales charts for the Accounts reports panel. Lazy-loaded so
 * recharts stays out of the Accounts route's main chunk.
 */
export function AccountsSalesCharts({ orders, salesByPersonData, salesByItem }: AccountsSalesChartsProps) {
  const customerCashData = useMemo(
    () => orders.slice(0, 10).map((order) => ({ name: order.customer_name, total: order.total })),
    [orders]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Cash Received by Customer</CardTitle></CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={customerCashData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} />
                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Cash Received by Admin</CardTitle></CardHeader>
        <CardContent>
          {salesByPersonData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={salesByPersonData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {salesByPersonData.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Legend />
                <ChartTooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Posted Invoice Sales by Item</CardTitle></CardHeader>
        <CardContent>
          {salesByItem.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No item data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={salesByItem}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip
                  formatter={(value, name) => [
                    name === 'total' ? `KES ${Number(value).toLocaleString()}` : Number(value).toLocaleString(),
                    name === 'total' ? 'Amount' : 'Quantity',
                  ]}
                />
                <Bar dataKey="quantity" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
