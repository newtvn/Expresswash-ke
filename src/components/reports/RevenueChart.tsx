import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RevenueByItemType } from '@/types';

const COLORS = {
  bar: '#0d9488',
};

interface RevenueChartProps {
  data: RevenueByItemType[];
}

export const RevenueChart = ({ data }: RevenueChartProps) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by Item Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
            No revenue data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedData = [...data].sort((a, b) => b.revenue - a.revenue);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue by Item Type</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, sortedData.length * 50)}>
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              tickFormatter={(value: number) => `KES ${(value / 1000).toFixed(0)}k`}
            />
            <YAxis
              type="category"
              dataKey="itemType"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, _name: string, props: { payload: RevenueByItemType }) => {
                const item = props.payload;
                return [
                  `KES ${value.toLocaleString()} (${item.orders} orders)`,
                  'Revenue',
                ];
              }}
            />
            <Bar
              dataKey="revenue"
              fill={COLORS.bar}
              radius={[0, 4, 4, 0]}
              name="Revenue"
              barSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
