import { lazy, Suspense, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getDashboardKPIs, getSalesData, getOrderStatusCounts } from '@/services/reportService';
import { getOrders } from '@/services/orderService';
import { getOrderStatusLabel } from '@/constants/orderStatus';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { StatusBadge } from '@/components/shared';
import { getOrderStatusBadgeKey } from '@/constants/orderStatus';
import { AlertTriangle, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/types';

const SalesChart = lazy(() =>
  import('@/components/reports').then((m) => ({ default: m.SalesChart }))
);

// ── Pipeline stage config ──────────────────────────────────────────

interface StageConfig {
  key: string;
  statusCode: number;
  label: string;
  shortLabel: string;
  group: 'intake' | 'proc' | 'qc' | 'del';
}

const STAGES: StageConfig[] = [
  { key: 'pending',   statusCode: 1,  label: 'Pending',           shortLabel: 'Pending',       group: 'intake' },
  { key: 'confirmed', statusCode: 2,  label: 'Confirmed',         shortLabel: 'Confirmed',     group: 'intake' },
  { key: 'driver',    statusCode: 3,  label: 'Driver assigned',   shortLabel: 'Driver asgn.',  group: 'intake' },
  { key: 'pickup',    statusCode: 4,  label: 'Pickup scheduled',  shortLabel: 'Pickup sch.',   group: 'intake' },
  { key: 'picked',    statusCode: 5,  label: 'Picked up',         shortLabel: 'Picked up',     group: 'proc' },
  { key: 'inProc',    statusCode: 6,  label: 'In processing',     shortLabel: 'In processing', group: 'proc' },
  { key: 'procComp',  statusCode: 7,  label: 'Processing complete', shortLabel: 'Proc. comp.', group: 'proc' },
  { key: 'qCheck',    statusCode: 8,  label: 'Quality check',     shortLabel: 'Quality check', group: 'qc' },
  { key: 'qApprov',   statusCode: 9,  label: 'Quality approved',  shortLabel: 'Q. approved',   group: 'qc' },
  { key: 'outDel',    statusCode: 11, label: 'Out for delivery',  shortLabel: 'Out for del.',  group: 'del' },
  { key: 'delivered', statusCode: 12, label: 'Delivered',         shortLabel: 'Delivered',     group: 'del' },
  { key: 'cancelled', statusCode: 13, label: 'Cancelled',         shortLabel: 'Cancelled',     group: 'del' },
];

const GROUP_LABELS: Record<string, string> = { intake: 'INTAKE', proc: 'PROC', qc: 'QC', del: 'DEL' };

function groupColor(group: string, key: string): string {
  if (key === 'cancelled') return 'var(--dash-neg)';
  switch (group) {
    case 'intake': return 'var(--dash-violet)';
    case 'proc':   return 'var(--dash-accent)';
    case 'qc':     return 'var(--dash-warn)';
    case 'del':    return 'var(--dash-pos)';
    default:       return 'var(--dash-ink-4)';
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const avatarColors = [
  { bg: 'oklch(92% 0.05 220)', fg: 'oklch(40% 0.1 220)' },
  { bg: 'oklch(92% 0.05 155)', fg: 'oklch(38% 0.1 155)' },
  { bg: 'oklch(92% 0.05 75)',  fg: 'oklch(40% 0.1 75)' },
  { bg: 'oklch(92% 0.05 285)', fg: 'oklch(40% 0.1 285)' },
];

function statusPillClass(status: number): string {
  if (status >= 1 && status <= 4) return 'dash-pill-vio';
  if (status >= 5 && status <= 7) return 'dash-pill-acc';
  if (status >= 8 && status <= 9) return 'dash-pill-warn';
  if (status === 11) return 'dash-pill-vio';
  if (status === 12) return 'dash-pill-pos';
  if (status === 13) return 'dash-pill-neg';
  return '';
}

function getServiceSummary(items: { name: string; quantity: number }[]): string {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0].name;
  return `${items[0].name}+`;
}

// ── Main Component ──────────────────────────────────────────────────

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['admin', 'dashboard', 'kpis'],
    queryFn: getDashboardKPIs,
    refetchInterval: 60_000,
  });

  const { data: salesData = [] } = useQuery({
    queryKey: ['admin', 'dashboard', 'sales'],
    queryFn: () => getSalesData(30),
  });

  const { data: statusCounts = [] } = useQuery({
    queryKey: ['admin', 'dashboard', 'statusCounts'],
    queryFn: getOrderStatusCounts,
  });

  const { data: deliveryMetrics } = useQuery({
    queryKey: ['admin', 'dashboard', 'deliveryMetrics'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_delivery_metrics');
        if (error || !data) return { avgDays: 0, deliveredTotal: 0, onTimeCount: 0, onTimeRate: 0 };
        return {
          avgDays: Number(data.avg_days) ?? 0,
          deliveredTotal: Number(data.delivered_total) ?? 0,
          onTimeCount: Number(data.on_time_count) ?? 0,
          onTimeRate: Number(data.on_time_rate) ?? 0,
        };
      } catch {
        return { avgDays: 0, deliveredTotal: 0, onTimeCount: 0, onTimeRate: 0 };
      }
    },
  });

  const { data: recentOrdersResult } = useQuery({
    queryKey: ['admin', 'dashboard', 'recentOrders'],
    queryFn: () => getOrders({ page: 1, limit: 4 }),
  });

  const recentOrders = (recentOrdersResult?.data ?? []).map((o) => ({
    ...o,
    amount: o.total ?? 0,
  }));

  // Map status counts to pipeline stages
  const stageCounts = useMemo(() => {
    const countMap: Record<string, number> = {};
    statusCounts.forEach((sc) => {
      countMap[sc.status] = sc.count;
    });

    return STAGES.map((stage) => {
      const label = getOrderStatusLabel(stage.statusCode);
      const count = countMap[label] ?? 0;
      return { ...stage, count };
    });
  }, [statusCounts]);

  const maxCount = Math.max(...stageCounts.map(s => s.count), 1);
  const totalActive = stageCounts.reduce((s, c) => s + c.count, 0);
  const cancelledCount = stageCounts.find(s => s.key === 'cancelled')?.count ?? 0;
  const deliveredCount = stageCounts.find(s => s.key === 'delivered')?.count ?? 0;
  const cancellationRate = totalActive > 0 ? Math.round((cancelledCount / totalActive) * 100) : 0;

  // Compute attention items from real data
  const attentionItems = useMemo(() => {
    const items: { severity: 'urgent' | 'warn' | 'info'; title: string; desc: string; badge: string; link: string }[] = [];

    if (cancellationRate > 15) {
      items.push({ severity: 'urgent', title: `${cancelledCount} orders cancelled`, desc: 'Review driver routing and pickup scheduling', badge: `${cancellationRate}% rate`, link: '/admin/orders?status=13' });
    }

    if (kpis && kpis.ordersPending > 1) {
      items.push({ severity: 'warn', title: `${kpis.ordersPending} orders awaiting confirmation`, desc: 'Pending orders need driver assignment', badge: `${kpis.ordersPending} pending`, link: '/admin/orders?status=1' });
    }

    if (kpis && kpis.unpaidInvoices > 0) {
      items.push({ severity: 'urgent', title: `${kpis.unpaidInvoices} unpaid invoices · KES ${kpis.outstandingAmount.toLocaleString()}`, desc: 'Includes overdue and pending invoices', badge: `${kpis.unpaidInvoices} unpaid`, link: '/admin/billing' });
    }

    const qcCount = stageCounts.find(s => s.key === 'qCheck')?.count ?? 0;
    if (qcCount > 0) {
      items.push({ severity: 'info', title: `Quality check queue at ${qcCount}`, desc: qcCount <= 2 ? 'Clearing in under SLA · no action needed' : 'Queue building up — may need attention', badge: qcCount <= 2 ? 'ok' : `${qcCount} items`, link: '/admin/orders?status=8' });
    }

    if (items.length === 0) {
      items.push({ severity: 'info', title: "You're all caught up", desc: 'No items need attention right now', badge: '✓', link: '/admin/orders' });
    }

    return items;
  }, [kpis, cancellationRate, cancelledCount, stageCounts]);

  // Bottleneck: highest non-terminal stage
  const bottleneck = useMemo(() => {
    const nonTerminal = stageCounts.filter(s => !['delivered', 'cancelled'].includes(s.key) && s.count > 0);
    if (nonTerminal.length === 0) return null;
    return nonTerminal.reduce((max, s) => s.count > max.count ? s : max, nonTerminal[0]);
  }, [stageCounts]);


  // Revenue summary for chart header
  const revTotal = kpis?.totalRevenue ?? 0;
  const revAvgDay = salesData.length > 0 ? Math.round(revTotal / Math.max(salesData.length, 1)) : 0;

  if (kpisLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-80" />
        <div className="grid grid-cols-[1.2fr_1fr] gap-4 mt-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-56 rounded-xl" />
        <div className="grid grid-cols-[1.3fr_1fr] gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Block 1: Topbar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting()}, {firstName}.
          </h1>
          <p className="text-muted-foreground mt-1">
            {totalActive} orders in the pipeline{attentionItems.length > 0 && attentionItems[0].title !== "You're all caught up" ? ` · ${attentionItems.length} need your attention` : ''}
          </p>
        </div>
      </div>

      {/* ── Block 2: Focus Row ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        {/* Today's Focus */}
        <div
          className="rounded-[14px] p-7 overflow-hidden"
          style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-line)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--dash-ink-3)' }}>
              Business snapshot
            </p>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[260px]">
                  <p className="text-xs font-medium mb-1">Total Revenue</p>
                  <p className="text-[11px] text-muted-foreground">
                    Sum of all completed payments to date. The mini KPIs below show today's activity. Revenue updates in real time as payments are processed.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-lg text-muted-foreground">KES</span>
            <span className="text-5xl font-bold leading-none tracking-tight text-primary">
              {(kpis?.totalRevenue ?? 0).toLocaleString()}
            </span>
            <span className="text-lg text-muted-foreground">
              total revenue
            </span>
          </div>
          <p className="text-[13px] mb-6" style={{ color: 'var(--dash-ink-3)' }}>
            {kpis?.revenueToday === 0 ? 'No revenue billed today yet' : `KES ${kpis?.revenueToday.toLocaleString()} billed today`}
            {' · '}{kpis?.ordersToday ?? 0} order{(kpis?.ordersToday ?? 0) !== 1 ? 's' : ''} placed
            {' · '}{kpis?.ordersInProgress ?? 0} in progress
          </p>

          {/* Mini KPIs */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { caption: 'Orders today', value: String(kpis?.ordersToday ?? 0) },
              { caption: 'Customers', value: String(kpis?.totalCustomers ?? 0) },
              { caption: 'Unpaid', value: String(kpis?.unpaidInvoices ?? 0), sub: `· ${(kpis?.outstandingAmount ?? 0).toLocaleString()}` },
              { caption: 'Rating', value: (kpis?.avgRating ?? 0).toFixed(1), sub: '★' },
            ].map((m) => (
              <div key={m.caption}>
                <p className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--dash-ink-4)' }}>
                  {m.caption}
                </p>
                <p className="text-[22px] font-semibold tabular-nums leading-none">
                  {m.value}
                  {m.sub && <span className="text-[12px] font-normal ml-1.5" style={{ color: 'var(--dash-ink-3)' }}>{m.sub}</span>}
                </p>
              </div>
            ))}
          </div>

          {/* 7-day revenue sparkline */}
          {salesData.length > 0 && (
            <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--dash-line)' }}>
              <p className="text-[11px] uppercase tracking-[0.08em] mb-3" style={{ color: 'var(--dash-ink-4)' }}>
                Recent revenue
              </p>
              <ResponsiveContainer width="100%" height={56}>
                <AreaChart data={salesData.slice(-7)} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
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
            </div>
          )}
        </div>

        {/* Needs Attention */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-line)' }}
        >
          <div className="flex items-baseline gap-2 mb-4">
            <p className="text-[13px] font-semibold">Needs attention</p>
            <p className="text-[11.5px]" style={{ color: 'var(--dash-ink-3)' }}>{attentionItems.length} items</p>
          </div>
          <div className="flex flex-col gap-2">
            {attentionItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-[10px] cursor-pointer transition-colors hover:bg-[var(--dash-surface-2)]"
                style={{ border: '1px solid var(--dash-line)', background: 'var(--dash-surface)' }}
                onClick={() => navigate(item.link)}
              >
                <div
                  className="w-1.5 h-9 rounded-sm shrink-0"
                  style={{
                    background: item.severity === 'urgent' ? 'var(--dash-neg)'
                      : item.severity === 'info' ? 'var(--dash-accent)'
                      : 'var(--dash-warn)',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{item.title}</p>
                  <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--dash-ink-3)' }}>{item.desc}</p>
                </div>
                <span
                  className="text-[12px] px-2 py-1 rounded-md shrink-0 tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--dash-surface-2)', color: 'var(--dash-ink-2)' }}
                >
                  {item.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Block 3: Pipeline Hero ──────────────────────────────── */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-line)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[15px] font-semibold">Order pipeline</p>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--dash-ink-3)' }}>
              Every active order, grouped by where it is in the journey
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11.5px]" style={{ color: 'var(--dash-ink-2)' }}>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--dash-accent)' }} />Healthy
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--dash-warn)' }} />Slowing
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--dash-neg)' }} />At risk
            </span>
          </div>
        </div>

        {/* 12-col stage grid */}
        <div className="grid grid-cols-12 gap-1.5 overflow-x-auto">
          {stageCounts.map((stage) => {
            const color = groupColor(stage.group, stage.key);
            return (
              <div
                key={stage.key}
                className="flex flex-col justify-between rounded-lg p-2.5 min-h-[120px] cursor-pointer hover:shadow-sm transition-shadow"
                style={{ border: '1px solid var(--dash-line)', background: 'var(--dash-surface)' }}
                onClick={() => navigate(`/admin/orders?status=${stage.statusCode}`)}
              >
                <div>
                  <p className="text-[9.5px] uppercase tracking-[0.08em] mb-1" style={{ color }}>
                    {GROUP_LABELS[stage.group]}
                  </p>
                  <p className="text-[22px] font-semibold tabular-nums leading-none tracking-[-0.02em]">
                    {stage.count}
                  </p>
                  <p className="text-[10.5px] leading-tight mt-1" style={{ color: 'var(--dash-ink-2)' }}>
                    {stage.shortLabel}
                  </p>
                </div>
                <div className="h-[3px] rounded-full mt-2.5 overflow-hidden" style={{ background: 'var(--dash-line)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(stage.count / maxCount) * 100}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Metric strip — uses same 12-col grid as pipeline, 3 cols each */}
        <div className="border-t mt-5 pt-5 grid grid-cols-12 gap-1.5" style={{ borderColor: 'var(--dash-line)' }}>
          <div className="col-span-3">
            <p className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--dash-ink-4)' }}>
              Avg time to delivery
            </p>
            <p className="text-[28px] font-semibold tracking-[-0.02em] leading-none">
              {deliveryMetrics ? deliveryMetrics.avgDays.toFixed(1) : '—'}
              <span className="text-[14px] font-normal ml-1" style={{ color: 'var(--dash-ink-3)' }}>days</span>
            </p>
          </div>
          <div className="col-span-3">
            <p className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--dash-ink-4)' }}>
              Biggest bottleneck
            </p>
            <p className="text-[18px] font-semibold tracking-[-0.01em] leading-tight">
              {bottleneck?.label ?? 'None'}
            </p>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--dash-ink-3)' }}>
              {bottleneck ? `${bottleneck.count} order${bottleneck.count !== 1 ? 's' : ''} in stage` : 'No bottleneck'}
            </p>
          </div>
          <div className="col-span-3">
            <p className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--dash-ink-4)' }}>
              Cancellation rate
            </p>
            <p className="text-[28px] font-semibold tracking-[-0.02em] leading-none">
              {cancellationRate}%
              <span className="text-[14px] font-normal ml-1.5" style={{ color: cancellationRate > 15 ? 'var(--dash-neg)' : 'var(--dash-pos)' }}>
                {cancellationRate > 15 ? 'high' : 'normal'}
              </span>
            </p>
            <p className="text-[11.5px] mt-1" style={{ color: 'var(--dash-ink-3)' }}>
              {cancelledCount} of {totalActive} this month
            </p>
          </div>
          <div className="col-span-3">
            <p className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--dash-ink-4)' }}>
              On-time delivery
            </p>
            <p className="text-[28px] font-semibold tracking-[-0.02em] leading-none">
              {deliveryMetrics ? `${deliveryMetrics.onTimeRate}%` : '—'}
            </p>
            <p className="text-[11.5px] mt-1" style={{ color: 'var(--dash-ink-3)' }}>
              {deliveryMetrics ? `${deliveryMetrics.onTimeCount} of ${deliveryMetrics.deliveredTotal} on time` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── Block 4: Bottom Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        {/* Revenue Chart */}
        <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
          <SalesChart data={salesData} />
        </Suspense>

        {/* Recent Orders */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-line)' }}
        >
          <div className="flex items-baseline gap-2 mb-4">
            <p className="text-[13px] font-semibold">Recent orders</p>
            <p className="text-[11.5px]" style={{ color: 'var(--dash-ink-3)' }}>Last {recentOrders.length}</p>
            <div className="flex-1" />
            <button
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] cursor-pointer"
              style={{ border: '1px solid var(--dash-line)', background: 'var(--dash-surface)', color: 'var(--dash-ink-2)' }}
              onClick={() => navigate('/admin/orders')}
            >
              All orders →
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--dash-line-2)' }}>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--dash-ink-3)' }}>No recent orders</p>
            ) : (
              recentOrders.map((order, i) => {
                const aColor = avatarColors[i % avatarColors.length];
                return (
                  <div
                    key={order.trackingCode}
                    className="flex items-center gap-3 py-3 cursor-pointer transition-colors"
                    style={{ borderColor: 'var(--dash-line-2)' }}
                    onClick={() => navigate(`/admin/orders/${order.trackingCode}`)}
                  >
                    <div
                      className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-semibold shrink-0"
                      style={{ background: aColor.bg, color: aColor.fg, border: '1px solid var(--dash-line)' }}
                    >
                      {getInitials(order.customerName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{order.customerName}</p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--dash-ink-3)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {order.trackingCode} · {getServiceSummary(order.items)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-medium tabular-nums">
                        KES {order.amount.toLocaleString()}
                      </p>
                      <StatusBadge status={getOrderStatusBadgeKey(order.status)} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
