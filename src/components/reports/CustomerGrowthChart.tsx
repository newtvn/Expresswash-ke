import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = {
  totalCustomers: '#0d9488',
  newCustomers: '#06b6d4',
};

interface CustomerGrowthData {
  month: string;
  newCustomers: number;
  totalCustomers: number;
  churnRate: number;
}

interface CustomerGrowthChartProps {
  data: CustomerGrowthData[];
}

export const CustomerGrowthChart = ({ data }: CustomerGrowthChartProps) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Growth</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
            No customer growth data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Customer Growth</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="totalCustomersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.totalCustomers} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.totalCustomers} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="newCustomersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.newCustomers} stopOpacity={0.4} />
                <stop offset="95%" stopColor={COLORS.newCustomers} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                return [value.toLocaleString(), name];
              }}
              labelFormatter={(label: string) => label}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
            <Area
              type="monotone"
              dataKey="totalCustomers"
              stroke={COLORS.totalCustomers}
              strokeWidth={2}
              fill="url(#totalCustomersGradient)"
              name="Total Customers"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="newCustomers"
              stroke={COLORS.newCustomers}
              strokeWidth={2}
              fill="url(#newCustomersGradient)"
              name="New Customers"
              stackId="2"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
