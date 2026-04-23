import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PageHeader, DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Medal, Award, Star, Users, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Tier metadata (static) ───────────────────────────────────────────
const tierMeta = [
  { tier: "Platinum", color: "bg-violet-100 text-violet-700 border-violet-200", titleColor: "text-violet-700", bgAccent: "bg-violet-50 border-violet-200", icon: Crown, minPoints: 5000, maxPoints: null, description: "Top-tier customers who get priority service, exclusive discounts, and VIP support.", perks: ["Priority customer support", "Exclusive seasonal discounts", "Free express service", "Birthday bonus points"] },
  { tier: "Gold", color: "bg-yellow-100 text-yellow-700 border-yellow-200", titleColor: "text-yellow-700", bgAccent: "bg-yellow-50 border-yellow-200", icon: Medal, minPoints: 2000, maxPoints: 4999, description: "Loyal customers with access to premium rewards and early promotions.", perks: ["Early access to promotions", "2x points on referrals", "Free pickup & delivery"] },
  { tier: "Silver", color: "bg-gray-100 text-gray-700 border-gray-200", titleColor: "text-gray-700", bgAccent: "bg-gray-50 border-gray-200", icon: Award, minPoints: 500, maxPoints: 1999, description: "Regular customers who earn bonus points and unlock standard rewards.", perks: ["Redeem points for discounts", "Referral bonus points"] },
  { tier: "Bronze", color: "bg-orange-100 text-orange-700 border-orange-200", titleColor: "text-orange-600", bgAccent: "bg-orange-50 border-orange-200", icon: Star, minPoints: 0, maxPoints: 499, description: "New or occasional customers starting their loyalty journey.", perks: ["Earn 1 point per KES 100 spent", "Access to basic rewards"] },
] as const;

const tierColors: Record<string, string> = {
  Platinum: "bg-violet-100 text-violet-700 border-violet-200",
  Gold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Silver: "bg-gray-100 text-gray-700 border-gray-200",
  Bronze: "bg-orange-100 text-orange-700 border-orange-200",
};

// ── Top earner row shape ─────────────────────────────────────────────
interface TopEarner {
  id: string;
  name: string;
  email: string;
  tier: string;
  points: number;
  totalSpent: number;
  orders: number;
  joined: string;
}

const topEarnerColumns: Column<TopEarner>[] = [
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
  // ── Query: tier counts ─────────────────────────────────────────────
  const { data: tierCounts, isLoading: tiersLoading } = useQuery({
    queryKey: ["admin", "loyalty", "tiers"],
    queryFn: async () => {
      const { data } = await supabase.from("loyalty_accounts").select("tier");
      if (!data) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      data.forEach((a) => {
        counts[a.tier] = (counts[a.tier] || 0) + 1;
      });
      return counts;
    },
  });

  // ── Query: program stats ───────────────────────────────────────────
  const { data: programStats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "loyalty", "stats"],
    queryFn: async () => {
      // Total members & lifetime points
      const { data: accounts } = await supabase
        .from("loyalty_accounts")
        .select("lifetime_points");

      const totalMembers = accounts?.length ?? 0;
      const totalPointsIssued = accounts?.reduce(
        (sum, a) => sum + ((a.lifetime_points as number) ?? 0),
        0,
      ) ?? 0;

      // Redeemed transactions
      const { data: redeemed } = await supabase
        .from("loyalty_transactions")
        .select("points")
        .eq("type", "redeemed");

      const pointsRedeemed = redeemed?.reduce(
        (sum, t) => sum + Math.abs((t.points as number) ?? 0),
        0,
      ) ?? 0;
      const rewardsClaimed = redeemed?.length ?? 0;

      const redemptionRate =
        totalPointsIssued > 0
          ? ((pointsRedeemed / totalPointsIssued) * 100).toFixed(1)
          : "0.0";

      return [
        { label: "Total Members", value: totalMembers.toLocaleString(), subtitle: "Enrolled customers" },
        { label: "Total Points Issued", value: totalPointsIssued.toLocaleString(), subtitle: "Across all tiers" },
        { label: "Points Redeemed", value: pointsRedeemed.toLocaleString(), subtitle: `${redemptionRate}% redemption rate` },
        { label: "Rewards Claimed", value: rewardsClaimed.toLocaleString(), subtitle: "All time" },
      ];
    },
  });

  // ── Query: top earners ─────────────────────────────────────────────
  const { data: topEarners, isLoading: earnersLoading } = useQuery({
    queryKey: ["admin", "loyalty", "topEarners"],
    queryFn: async () => {
      const { data: accounts } = await supabase
        .from("loyalty_accounts")
        .select("customer_id, points, tier, lifetime_points, customer_name")
        .order("lifetime_points", { ascending: false })
        .limit(20);

      if (!accounts || accounts.length === 0) return [] as TopEarner[];

      // Fetch matching profiles for email, total_spent, total_orders, created_at
      const customerIds = accounts.map((a) => a.customer_id as string);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, total_spent, total_orders, created_at")
        .in("id", customerIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id as string, p]),
      );

      return accounts.map((a): TopEarner => {
        const profile = profileMap.get(a.customer_id as string);
        return {
          id: a.customer_id as string,
          name: (a.customer_name as string) ?? "Unknown",
          email: (profile?.email as string) ?? "-",
          tier: (a.tier as string) ?? "Bronze",
          points: (a.lifetime_points as number) ?? 0,
          totalSpent: (profile?.total_spent as number) ?? 0,
          orders: (profile?.total_orders as number) ?? 0,
          joined: profile?.created_at
            ? new Date(profile.created_at as string).toISOString().split("T")[0]
            : "-",
        };
      });
    },
  });

  // ── Derived tier overview ──────────────────────────────────────────
  const tierOverview = tierMeta.map((meta) => ({
    ...meta,
    members: tierCounts?.[meta.tier] ?? 0,
  }));

  const totalMembers = tierOverview.reduce((sum, t) => sum + t.members, 0);

  // ── Stat skeleton helper ───────────────────────────────────────────
  const StatSkeleton = () => (
    <Card className="bg-card border-border/50">
      <CardContent className="p-5 space-y-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );

  const TierSkeleton = () => (
    <div className="text-center p-4 rounded-xl border border-border/50 space-y-3">
      <Skeleton className="w-12 h-12 rounded-xl mx-auto" />
      <Skeleton className="h-5 w-10 mx-auto" />
      <Skeleton className="h-4 w-16 mx-auto" />
      <Skeleton className="h-3 w-24 mx-auto" />
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Loyalty Program" description="Manage loyalty tiers, points, and rewards" />

      {/* Program Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : (programStats ?? []).map((stat) => (
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
            {tiersLoading
              ? Array.from({ length: 4 }).map((_, i) => <TierSkeleton key={i} />)
              : tierOverview.map((tier) => (
                  <div
                    key={tier.tier}
                    className="relative text-center p-4 rounded-xl border border-border/50"
                  >
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="absolute top-3 right-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                            <Info className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className={`max-w-[280px] p-0 overflow-hidden border ${tier.bgAccent}`}>
                          <div className={`px-3 py-2 border-b ${tier.bgAccent}`}>
                            <div className="flex items-center gap-2">
                              <tier.icon className={`w-4 h-4 ${tier.titleColor}`} />
                              <p className={`font-bold ${tier.titleColor}`}>{tier.tier} Tier</p>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {tier.minPoints.toLocaleString()}{tier.maxPoints ? ` - ${tier.maxPoints.toLocaleString()}` : '+'} lifetime points
                            </p>
                          </div>
                          <div className="px-3 py-2 bg-background">
                            <p className="text-xs text-foreground">{tier.description}</p>
                            <ul className="mt-2 space-y-1">
                              {tier.perks.map((perk) => (
                                <li key={perk} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                  <span className={`mt-0.5 ${tier.titleColor}`}>&#10003;</span>
                                  {perk}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${tier.color}`}>
                      <tier.icon className="w-6 h-6" />
                    </div>
                    <p className="text-lg font-bold text-foreground">{tier.members}</p>
                    <p className="text-sm font-medium text-foreground">{tier.tier}</p>
                    <p className="text-xs text-muted-foreground">
                      {totalMembers > 0
                        ? ((tier.members / totalMembers) * 100).toFixed(1)
                        : "0.0"}% of members
                    </p>
                    <div className="mt-2 w-full bg-secondary rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all"
                        style={{ width: `${totalMembers > 0 ? (tier.members / totalMembers) * 100 : 0}%` }}
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
          {earnersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              data={topEarners ?? []}
              columns={topEarnerColumns}
              searchPlaceholder="Search members..."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoyaltyManagement;
