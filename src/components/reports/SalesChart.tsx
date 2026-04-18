import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SalesReportData } from '@/types';

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
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Sales Overview</CardTitle>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#2e88d1]/70" />
            Orders
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full bg-[#0d9488]" />
            Revenue
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              allowDecimals={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              tickFormatter={(value: number) =>
                value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'Revenue') return [`KES ${value.toLocaleString()}`, name];
                return [value.toLocaleString(), name];
              }}
              labelFormatter={(label: string) => {
                return new Date(label).toLocaleDateString('en-KE', {
                  day: 'numeric', month: 'short', year: 'numeric',
                });
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="orders"
              fill="#2e88d1"
              opacity={0.7}
              radius={[3, 3, 0, 0]}
              name="Orders"
              barSize={data.length > 30 ? 8 : 20}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="revenue"
              stroke="#0d9488"
              strokeWidth={2.5}
              dot={data.length <= 30 ? { r: 3, fill: '#0d9488' } : false}
              activeDot={{ r: 5 }}
              name="Revenue"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
