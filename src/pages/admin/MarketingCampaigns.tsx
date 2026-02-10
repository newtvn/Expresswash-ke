import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Send, Users, BarChart3, Megaphone } from "lucide-react";

const campaignStats = [
  { label: "Total Campaigns", value: "24", icon: Megaphone, color: "bg-primary/10 text-primary" },
  { label: "Messages Sent", value: "12,480", icon: Send, color: "bg-blue-100 text-blue-600" },
  { label: "Unique Reach", value: "3,250", icon: Users, color: "bg-emerald-100 text-emerald-600" },
  { label: "Avg Open Rate", value: "68%", icon: BarChart3, color: "bg-amber-100 text-amber-600" },
];

const mockCampaigns = [
  { id: "C-001", name: "Holiday Season Sale", type: "SMS", audience: "All Customers", sent: 2480, delivered: 2350, failed: 130, status: "completed", date: "2024-12-01" },
  { id: "C-002", name: "New Customer Welcome", type: "Email", audience: "New Signups", sent: 156, delivered: 152, failed: 4, status: "active", date: "2024-12-10" },
  { id: "C-003", name: "Loyalty Points Reminder", type: "SMS", audience: "Gold & Platinum", sent: 420, delivered: 415, failed: 5, status: "completed", date: "2024-11-28" },
  { id: "C-004", name: "Referral Bonus Push", type: "Push Notification", audience: "Active Users", sent: 1850, delivered: 1780, failed: 70, status: "completed", date: "2024-11-15" },
  { id: "C-005", name: "January New Year Promo", type: "SMS", audience: "All Customers", sent: 0, delivered: 0, failed: 0, status: "pending", date: "2025-01-01" },
  { id: "C-006", name: "Feedback Request Q4", type: "Email", audience: "Recent Orders", sent: 890, delivered: 865, failed: 25, status: "completed", date: "2024-12-05" },
  { id: "C-007", name: "Sofa Cleaning Special", type: "SMS", audience: "Sofa Customers", sent: 320, delivered: 312, failed: 8, status: "active", date: "2024-12-12" },
];

const campaignColumns: Column<(typeof mockCampaigns)[0]>[] = [
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
 */
export const MarketingCampaigns = () => {
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
        data={mockCampaigns}
        columns={campaignColumns}
        searchPlaceholder="Search campaigns..."
      />
    </div>
  );
};

export default MarketingCampaigns;
