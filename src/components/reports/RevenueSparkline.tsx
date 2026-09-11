import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface RevenueSparklineProps {
  data: { date: string; revenue: number }[];
}

/** 7-day revenue sparkline. Lazy-loaded so recharts stays out of the Dashboard chunk. */
export const RevenueSparkline = ({ data }: RevenueSparklineProps) => (
  <ResponsiveContainer width="100%" height={56}>
    <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
      <XAxis dataKey="date" hide />
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(207 64% 50%)" stopOpacity={0.2} />
          <stop offset="100%" stopColor="hsl(207 64% 50%)" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <RechartsTooltip
        contentStyle={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-line)', borderRadius: '8px', fontSize: '12px', padding: '6px 10px' }}
        labelFormatter={(label: string) => {
          const [y, m, d] = String(label).split('-').map(Number);
          return new Date(y, m - 1, d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
        }}
        formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Revenue']}
      />
      <Area
        type="monotone"
        dataKey="revenue"
        stroke="hsl(207 64% 50%)"
        strokeWidth={1.5}
        fill="url(#sparkFill)"
        dot={false}
        activeDot={{ r: 3, fill: 'hsl(207 64% 50%)', strokeWidth: 0 }}
      />
    </AreaChart>
  </ResponsiveContainer>
);
