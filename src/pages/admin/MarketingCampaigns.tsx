import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Users, BarChart3, Megaphone } from "lucide-react";

const campaignStats = [
  { label: "Total Campaigns", value: "--", icon: Megaphone, color: "bg-primary/10 text-primary" },
  { label: "Messages Sent", value: "--", icon: Send, color: "bg-blue-100 text-blue-600" },
  { label: "Unique Reach", value: "--", icon: Users, color: "bg-emerald-100 text-emerald-600" },
  { label: "Avg Open Rate", value: "--", icon: BarChart3, color: "bg-amber-100 text-amber-600" },
];

/**
 * Admin Marketing Campaigns Page
 * Coming soon — campaign management will be available in a future update.
 */
export const MarketingCampaigns = () => {
  return (
    <div className="space-y-6">
      <PageHeader title="Marketing Campaigns" description="Manage promotional campaigns and track engagement">
        <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
          Coming Soon
        </Badge>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {campaignStats.map((stat) => (
          <Card key={stat.label} className="bg-card border-border/50">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coming Soon */}
      <Card className="bg-card border-border/50">
        <CardContent className="py-16 text-center">
          <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Campaign Management Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Create and manage SMS and email marketing campaigns to engage your customers.
            This feature will be available in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingCampaigns;
