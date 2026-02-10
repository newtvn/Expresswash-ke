import { useState } from "react";
import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Bell, MessageSquare, FileText } from "lucide-react";

const notificationTemplates = [
  { id: "TPL-001", name: "Order Confirmation", type: "SMS", trigger: "Order Created", status: "active", lastUsed: "2024-12-15" },
  { id: "TPL-002", name: "Pickup Reminder", type: "SMS", trigger: "1hr Before Pickup", status: "active", lastUsed: "2024-12-15" },
  { id: "TPL-003", name: "Cleaning Complete", type: "SMS + Email", trigger: "Quality Check Pass", status: "active", lastUsed: "2024-12-14" },
  { id: "TPL-004", name: "Out for Delivery", type: "SMS", trigger: "Driver Dispatched", status: "active", lastUsed: "2024-12-14" },
  { id: "TPL-005", name: "Delivery Confirmation", type: "SMS + Email", trigger: "Delivered", status: "active", lastUsed: "2024-12-14" },
  { id: "TPL-006", name: "Invoice Ready", type: "Email", trigger: "Invoice Generated", status: "active", lastUsed: "2024-12-13" },
  { id: "TPL-007", name: "Payment Reminder", type: "SMS", trigger: "Invoice Overdue", status: "active", lastUsed: "2024-12-12" },
  { id: "TPL-008", name: "Review Request", type: "Email", trigger: "3 Days After Delivery", status: "inactive", lastUsed: "2024-12-10" },
];

const notificationHistory = [
  { id: "NOT-9001", recipient: "Grace Wanjiku", type: "SMS", template: "Order Confirmation", status: "completed", sentAt: "2024-12-15 14:30" },
  { id: "NOT-9002", recipient: "Peter Kamau", type: "SMS", template: "Pickup Reminder", status: "completed", sentAt: "2024-12-15 09:00" },
  { id: "NOT-9003", recipient: "Mary Njeri", type: "Email", template: "Cleaning Complete", status: "completed", sentAt: "2024-12-14 16:45" },
  { id: "NOT-9004", recipient: "John Odera", type: "SMS", template: "Payment Reminder", status: "failed", sentAt: "2024-12-14 10:00" },
  { id: "NOT-9005", recipient: "Sarah Wambui", type: "SMS", template: "Out for Delivery", status: "completed", sentAt: "2024-12-14 08:15" },
  { id: "NOT-9006", recipient: "David Maina", type: "Email", template: "Invoice Ready", status: "completed", sentAt: "2024-12-13 12:00" },
];

const templateColumns: Column<(typeof notificationTemplates)[0]>[] = [
  { key: "name", header: "Template Name", sortable: true },
  { key: "type", header: "Channel" },
  { key: "trigger", header: "Trigger" },
  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  { key: "lastUsed", header: "Last Used", sortable: true },
];

const historyColumns: Column<(typeof notificationHistory)[0]>[] = [
  { key: "id", header: "ID" },
  { key: "recipient", header: "Recipient", sortable: true },
  { key: "type", header: "Channel" },
  { key: "template", header: "Template" },
  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  { key: "sentAt", header: "Sent At", sortable: true },
];

/**
 * Admin Communications Page
 * Templates, send notification form, and notification history.
 */
export const Communications = () => {
  const [channel, setChannel] = useState("sms");

  return (
    <div className="space-y-6">
      <PageHeader title="Communications" description="Manage notification templates and send messages" />

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="send" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Send Notification
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <DataTable
            data={notificationTemplates}
            columns={templateColumns}
            searchPlaceholder="Search templates..."
          />
        </TabsContent>

        {/* Send Notification Tab */}
        <TabsContent value="send">
          <Card className="bg-card border-border/50 max-w-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Send Notification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="push">Push Notification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recipients</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    <SelectItem value="active">Active Customers</SelectItem>
                    <SelectItem value="zone-kitengela">Kitengela Zone</SelectItem>
                    <SelectItem value="zone-athi">Athi River Zone</SelectItem>
                    <SelectItem value="zone-nairobi">Nairobi Zone</SelectItem>
                    <SelectItem value="loyalty-gold">Gold & Platinum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {channel === "email" && (
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input placeholder="Notification subject line" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea placeholder="Type your message..." rows={4} />
              </div>
              <Button>
                <Send className="w-4 h-4 mr-2" />
                Send Notification
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <DataTable
            data={notificationHistory}
            columns={historyColumns}
            searchPlaceholder="Search notifications..."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Communications;
