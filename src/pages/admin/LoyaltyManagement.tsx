import { PageHeader, DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Medal, Award, Star, Users } from "lucide-react";

const tierOverview = [
  { tier: "Platinum", members: 23, color: "bg-violet-100 text-violet-700 border-violet-200", icon: Crown, minPoints: 5000 },
  { tier: "Gold", members: 67, color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Medal, minPoints: 2000 },
  { tier: "Silver", members: 185, color: "bg-gray-100 text-gray-700 border-gray-200", icon: Award, minPoints: 500 },
  { tier: "Bronze", members: 572, color: "bg-orange-100 text-orange-700 border-orange-200", icon: Star, minPoints: 0 },
];

const programStats = [
  { label: "Total Members", value: "847", subtitle: "Enrolled customers" },
  { label: "Total Points Issued", value: "324,500", subtitle: "Across all tiers" },
  { label: "Points Redeemed", value: "186,200", subtitle: "57.4% redemption rate" },
  { label: "Rewards Claimed", value: "1,245", subtitle: "This quarter" },
];

const topEarners = [
  { id: "u-101", name: "Grace Wanjiku", email: "grace@email.com", tier: "Platinum", points: 8450, totalSpent: 85000, orders: 42, joined: "2024-03-15" },
  { id: "u-220", name: "Sarah Wambui", email: "sarah@email.com", tier: "Platinum", points: 7200, totalSpent: 72000, orders: 38, joined: "2024-04-01" },
  { id: "u-115", name: "David Maina", email: "david@email.com", tier: "Platinum", points: 6800, totalSpent: 68000, orders: 35, joined: "2024-02-20" },
  { id: "u-189", name: "Ann Chebet", email: "ann@email.com", tier: "Gold", points: 4500, totalSpent: 45000, orders: 28, joined: "2024-05-10" },
  { id: "u-134", name: "Brian Otieno", email: "brian@email.com", tier: "Gold", points: 3800, totalSpent: 38000, orders: 24, joined: "2024-06-15" },
  { id: "u-156", name: "Lucy Wairimu", email: "lucy@email.com", tier: "Gold", points: 3200, totalSpent: 32000, orders: 20, joined: "2024-03-28" },
  { id: "u-201", name: "Tom Nyaga", email: "tom@email.com", tier: "Silver", points: 1900, totalSpent: 19000, orders: 15, joined: "2024-07-05" },
  { id: "u-178", name: "Esther Wangari", email: "esther@email.com", tier: "Silver", points: 1500, totalSpent: 15000, orders: 12, joined: "2024-08-12" },
];

const tierColors: Record<string, string> = {
  Platinum: "bg-violet-100 text-violet-700 border-violet-200",
  Gold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Silver: "bg-gray-100 text-gray-700 border-gray-200",
  Bronze: "bg-orange-100 text-orange-700 border-orange-200",
};

const topEarnerColumns: Column<(typeof topEarners)[0]>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "email", header: "Email" },
  {
    key: "tier",
    header: "Tier",
    sortable: true,
    render: (row) => (
      <Badge variant="outline" className={tierColors[row.tier]}>
        {row.tier}
      </Badge>
    ),
  },
  { key: "points", header: "Points", sortable: true, render: (row) => <span className="font-medium">{row.points.toLocaleString()}</span> },
  {
    key: "totalSpent",
    header: "Total Spent",
    sortable: true,
    render: (row) => <span className="font-medium">KES {row.totalSpent.toLocaleString()}</span>,
  },
  { key: "orders", header: "Orders", sortable: true },
  { key: "joined", header: "Joined", sortable: true },
];

/**
 * Admin Loyalty Management Page
 * Program overview, tier distribution, and top earners.
 */
export const LoyaltyManagement = () => {
  const totalMembers = tierOverview.reduce((sum, t) => sum + t.members, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Loyalty Program" description="Manage loyalty tiers, points, and rewards" />

      {/* Program Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {programStats.map((stat) => (
          <Card key={stat.label} className="bg-card border-border/50">
            <CardContent className="p-5">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm font-medium text-foreground">{stat.label}</p>
              <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tier Distribution */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Tier Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {tierOverview.map((tier) => (
              <div
                key={tier.tier}
                className="text-center p-4 rounded-xl border border-border/50"
              >
                <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${tier.color}`}>
                  <tier.icon className="w-6 h-6" />
                </div>
                <p className="text-lg font-bold text-foreground">{tier.members}</p>
                <p className="text-sm font-medium text-foreground">{tier.tier}</p>
                <p className="text-xs text-muted-foreground">
                  {((tier.members / totalMembers) * 100).toFixed(1)}% of members
                </p>
                {/* Progress bar */}
                <div className="mt-2 w-full bg-secondary rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all"
                    style={{ width: `${(tier.members / totalMembers) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Earners Table */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Top Earners</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={topEarners}
            columns={topEarnerColumns}
            searchPlaceholder="Search members..."
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default LoyaltyManagement;
