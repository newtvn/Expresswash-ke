import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SalesReportData } from '@/types';

const COLORS = {
  revenue: '#0d9488',
  orders: '#0891b2',
};

interface SalesChartProps {
  data: SalesReportData[];
}

export const SalesChart = ({ data }: SalesChartProps) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
            No sales data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sales Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              label={{
                value: 'Orders',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              tickFormatter={(value: number) => `${(value / 1000).toFixed(0)}k`}
              label={{
                value: 'Revenue (KES)',
                angle: 90,
                position: 'insideRight',
                style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'Revenue') return [`KES ${value.toLocaleString()}`, name];
                return [value.toLocaleString(), name];
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="orders"
              stroke={COLORS.orders}
              strokeWidth={2}
              dot={{ r: 3, fill: COLORS.orders }}
              activeDot={{ r: 5 }}
              name="Orders"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="revenue"
              stroke={COLORS.revenue}
              strokeWidth={2}
              dot={{ r: 3, fill: COLORS.revenue }}
              activeDot={{ r: 5 }}
              name="Revenue"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
