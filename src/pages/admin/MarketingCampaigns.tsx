import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Send, Users, BarChart3, Megaphone } from "lucide-react";

const campaignStats = [
  { label: "Total Campaigns", value: "0", icon: Megaphone, color: "bg-primary/10 text-primary" },
  { label: "Messages Sent", value: "0", icon: Send, color: "bg-blue-100 text-blue-600" },
  { label: "Unique Reach", value: "0", icon: Users, color: "bg-emerald-100 text-emerald-600" },
  { label: "Avg Open Rate", value: "0%", icon: BarChart3, color: "bg-amber-100 text-amber-600" },
];

type Campaign = {
  id: string;
  name: string;
  type: string;
  audience: string;
  sent: number;
  delivered: number;
  failed: number;
  status: string;
  date: string;
};

const campaignColumns: Column<Campaign>[] = [
  { key: "name", header: "Campaign", sortable: true },
  { key: "type", header: "Type", sortable: true },
  { key: "audience", header: "Audience" },
  {
    key: "sent",
    header: "Sent",
    sortable: true,
    render: (row) => <span className="font-medium">{row.sent.toLocaleString()}</span>,
  },
  {
    key: "delivered",
    header: "Delivered",
    sortable: true,
    render: (row) => (
      <span className="text-emerald-600 font-medium">{row.delivered.toLocaleString()}</span>
    ),
  },
  {
    key: "failed",
    header: "Failed",
    render: (row) => (
      <span className={row.failed > 0 ? "text-red-500 font-medium" : "text-muted-foreground"}>
        {row.failed}
      </span>
    ),
  },
  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  { key: "date", header: "Date", sortable: true },
];

/**
 * Admin Marketing Campaigns Page
 * Campaign list table with stats and create button.
 * TODO: Connect to real campaign service
 */
export const MarketingCampaigns = () => {
  // TODO: Fetch campaigns from Supabase
  const campaigns: Campaign[] = [];

  return (
    <div className="space-y-6">
      <PageHeader title="Marketing Campaigns" description="Manage promotional campaigns and track engagement">
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
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

      {/* Campaigns Table */}
      <DataTable
        data={campaigns}
        columns={campaignColumns}
        searchPlaceholder="Search campaigns..."
      />
    </div>
  );
};

export default MarketingCampaigns;
