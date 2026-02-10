import {
  SalesReportData,
  ZonePerformance,
  RevenueByItemType,
  KPIData,
} from '@/types';

// ─── Helpers ──────────────────────────────────────────────────

/** Returns an ISO date string for `days` days before today (midnight). */
const dayStr = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

/** Seed-able pseudo-random using a simple linear congruential generator. */
const seededRandom = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

// ─── SALES DATA (90 days) ─────────────────────────────────────

const rng = seededRandom(42);

/**
 * 90 days of daily sales data.
 * Base: ~15 orders/day, ~KES 52 500 revenue/day for a carpet cleaning biz.
 * Weekends see slightly higher volume.
 */
export const MOCK_SALES_DATA: SalesReportData[] = Array.from(
  { length: 90 },
  (_, i) => {
    const daysBack = 89 - i; // oldest first
    const date = dayStr(daysBack);

    // Day-of-week effect: 0 = Sun, 6 = Sat
    const dayOfWeek = new Date(date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // gradual growth trend (~0.3% per day)
    const trendMultiplier = 1 + (i / 90) * 0.27;

    // random noise +-20 %
    const noise = 0.8 + rng() * 0.4;

    const baseOrders = isWeekend ? 20 : 14;
    const orders = Math.round(baseOrders * trendMultiplier * noise);

    const baseAvg = 3200 + rng() * 800; // KES 3 200 – 4 000 avg order
    const avgOrderValue = Math.round(baseAvg);
    const revenue = orders * avgOrderValue;

    return {
      date,
      orders,
      revenue,
      avgOrderValue,
    };
  }
);

// ─── ZONE PERFORMANCE ─────────────────────────────────────────

export const MOCK_ZONE_PERFORMANCE: ZonePerformance[] = [
  {
    zone: 'Kitengela',
    orders: 1245,
    revenue: 4_360_000,
    avgDeliveryTime: 26, // hours
    customerSatisfaction: 4.6,
    onTimeRate: 92.3,
  },
  {
    zone: 'Syokimau & Mlolongo',
    orders: 987,
    revenue: 3_510_000,
    avgDeliveryTime: 22,
    customerSatisfaction: 4.7,
    onTimeRate: 94.1,
  },
  {
    zone: 'Athi River',
    orders: 862,
    revenue: 2_980_000,
    avgDeliveryTime: 30,
    customerSatisfaction: 4.4,
    onTimeRate: 88.7,
  },
  {
    zone: 'Greater Nairobi',
    orders: 1530,
    revenue: 5_620_000,
    avgDeliveryTime: 34,
    customerSatisfaction: 4.3,
    onTimeRate: 86.5,
  },
];

// ─── REVENUE BY ITEM TYPE ─────────────────────────────────────

export const MOCK_REVENUE_BY_ITEM: RevenueByItemType[] = [
  {
    itemType: 'Carpet',
    revenue: 6_120_000,
    orders: 2_040,
    avgPrice: 3_000,
  },
  {
    itemType: 'Chair',
    revenue: 1_480_000,
    orders: 740,
    avgPrice: 2_000,
  },
  {
    itemType: 'Curtain',
    revenue: 1_950_000,
    orders: 975,
    avgPrice: 2_000,
  },
  {
    itemType: 'Rug',
    revenue: 2_640_000,
    orders: 880,
    avgPrice: 3_000,
  },
  {
    itemType: 'Sofa',
    revenue: 3_360_000,
    orders: 840,
    avgPrice: 4_000,
  },
  {
    itemType: 'Mattress',
    revenue: 920_000,
    orders: 230,
    avgPrice: 4_000,
  },
];

// ─── KPI DATA ─────────────────────────────────────────────────

export const MOCK_KPI_DATA: KPIData[] = [
  {
    label: 'Total Revenue',
    value: 16_470_000,
    change: 12.4,
    changeDirection: 'up',
    format: 'currency',
  },
  {
    label: 'Active Orders',
    value: 148,
    change: 8.2,
    changeDirection: 'up',
    format: 'number',
  },
  {
    label: 'New Customers',
    value: 64,
    change: 5.7,
    changeDirection: 'up',
    format: 'number',
  },
  {
    label: 'Avg Order Value',
    value: 3_540,
    change: -2.1,
    changeDirection: 'down',
    format: 'currency',
  },
  {
    label: 'On-Time Delivery',
    value: 91.2,
    change: 1.8,
    changeDirection: 'up',
    format: 'percentage',
  },
  {
    label: 'Customer Satisfaction',
    value: 4.5,
    change: 0.0,
    changeDirection: 'flat',
    format: 'number',
  },
];
