import { PageHeader, KPICard } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Percent } from "lucide-react";

const summaryKPIs = [
  { label: "Total Revenue", value: 2450000, change: 12.5, changeDirection: "up" as const, icon: DollarSign, format: "currency" as const },
  { label: "Total Expenses", value: 1680000, change: 8.1, changeDirection: "up" as const, icon: TrendingDown, format: "currency" as const },
  { label: "Net Profit", value: 770000, change: 18.2, changeDirection: "up" as const, icon: TrendingUp, format: "currency" as const },
  { label: "Profit Margin", value: 31.4, change: 4.3, changeDirection: "up" as const, icon: Percent, format: "percentage" as const },
];

const monthlyData = [
  { month: "Jan", revenue: 185000, expenses: 128000 },
  { month: "Feb", revenue: 210000, expenses: 145000 },
  { month: "Mar", revenue: 248000, expenses: 168000 },
  { month: "Apr", revenue: 225000, expenses: 155000 },
  { month: "May", revenue: 275000, expenses: 185000 },
  { month: "Jun", revenue: 298000, expenses: 198000 },
  { month: "Jul", revenue: 320000, expenses: 210000 },
  { month: "Aug", revenue: 270000, expenses: 188000 },
  { month: "Sep", revenue: 305000, expenses: 205000 },
  { month: "Oct", revenue: 338000, expenses: 225000 },
  { month: "Nov", revenue: 365000, expenses: 240000 },
  { month: "Dec", revenue: 385000, expenses: 250000 },
];

const expenseCategories = [
  { category: "Staff Salaries", amount: 680000, percentage: 40.5 },
  { category: "Transport & Fuel", amount: 302400, percentage: 18.0 },
  { category: "Cleaning Supplies", amount: 252000, percentage: 15.0 },
  { category: "Rent & Utilities", amount: 168000, percentage: 10.0 },
  { category: "Equipment Maintenance", amount: 117600, percentage: 7.0 },
  { category: "Marketing", amount: 84000, percentage: 5.0 },
  { category: "Insurance", amount: 42000, percentage: 2.5 },
  { category: "Miscellaneous", amount: 34000, percentage: 2.0 },
];

const categoryColors = [
  "bg-primary",
  "bg-blue-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-gray-400",
];

/**
 * Admin Profit & Expense Page
 * KPI summary, revenue vs expenses chart, and expense breakdown.
 */
export const ProfitExpense = () => {
  const maxVal = Math.max(...monthlyData.map((d) => Math.max(d.revenue, d.expenses)));

  return (
    <div className="space-y-6">
      <PageHeader title="Profit & Expenses" description="Financial overview and expense tracking" />

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryKPIs.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Revenue vs Expenses Chart */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Revenue vs Expenses</CardTitle>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary" />
                <span className="text-muted-foreground">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-rose-400" />
                <span className="text-muted-foreground">Expenses</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end gap-1">
            {monthlyData.map((d) => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex gap-0.5 justify-center items-end" style={{ height: "200px" }}>
                  <div
                    className="w-[45%] bg-primary/80 hover:bg-primary rounded-t transition-colors"
                    style={{ height: `${(d.revenue / maxVal) * 200}px` }}
                  />
                  <div
                    className="w-[45%] bg-rose-400/80 hover:bg-rose-400 rounded-t transition-colors"
                    style={{ height: `${(d.expenses / maxVal) * 200}px` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{d.month}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Expense Breakdown */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Expense Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {expenseCategories.map((item, index) => (
              <div key={item.category} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${categoryColors[index]}`} />
                    <span className="text-foreground font-medium">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{item.percentage}%</span>
                    <span className="font-medium text-foreground w-28 text-right">
                      KES {item.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${categoryColors[index]} transition-all`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitExpense;
