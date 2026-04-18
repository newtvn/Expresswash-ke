import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Semantic colors: each status gets a color that reflects its meaning
const STATUS_COLORS: Record<string, string> = {
  Pending: '#f59e0b',           // amber - waiting
  Confirmed: '#3b82f6',         // blue - acknowledged
  'Driver Assigned': '#6366f1', // indigo - assigned
  'Pickup Scheduled': '#8b5cf6',// violet - scheduled
  'Picked Up': '#a78bfa',       // light violet - in motion
  'In Processing': '#f97316',   // orange - active work
  'Processing Complete': '#14b8a6', // teal - stage done
  'Quality Check': '#eab308',   // yellow - inspection
  'Quality Approved': '#22c55e',// green - passed
  'Ready for Dispatch': '#10b981', // emerald - ready
  'Out For Delivery': '#0ea5e9',// sky blue - en route
  Delivered: '#16a34a',         // dark green - complete
  Cancelled: '#ef4444',         // red - cancelled
  Refunded: '#f43f5e',          // rose - refunded
};

interface OrderStatusData {
  status: string;
  count: number;
  color?: string;
}

interface OrderStatusPieChartProps {
  data: OrderStatusData[];
}

const RADIAN = Math.PI / 180;

const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export const OrderStatusPieChart = ({ data }: OrderStatusPieChartProps) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
            No order status data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Order Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Chart */}
          <div className="w-full lg:w-1/2">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="status"
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={STATUS_COLORS[entry.status] || '#94a3b8'}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => {
                    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                    return [`${value} orders (${pct}%)`, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="w-full lg:w-1/2 grid grid-cols-2 gap-x-4 gap-y-2">
            {data.filter(d => d.count > 0).map((entry) => (
              <div key={entry.status} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[entry.status] || '#94a3b8' }}
                />
                <span className="text-muted-foreground truncate">{entry.status}</span>
                <span className="font-medium ml-auto">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
