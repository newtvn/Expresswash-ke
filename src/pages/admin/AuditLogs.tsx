import { useState } from "react";
import { PageHeader, DataTable, ExportButton, DateRangePicker } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const mockAuditLogs = [
  { id: "AL-9001", timestamp: "2024-12-15 14:32:15", user: "Admin User", role: "Admin", action: "UPDATE", entity: "Order", details: "Changed order EW-2024-01284 status to in_washing", ip: "192.168.1.45", suspicious: false },
  { id: "AL-9002", timestamp: "2024-12-15 14:28:00", user: "Grace Wanjiku", role: "Customer", action: "CREATE", entity: "Order", details: "Created new order EW-2024-01284", ip: "41.89.12.156", suspicious: false },
  { id: "AL-9003", timestamp: "2024-12-15 13:45:30", user: "Joseph Mwangi", role: "Driver", action: "UPDATE", entity: "Delivery", details: "Marked delivery EW-2024-01280 as completed", ip: "41.89.45.78", suspicious: false },
  { id: "AL-9004", timestamp: "2024-12-15 11:15:00", user: "Unknown", role: "--", action: "LOGIN_FAILED", entity: "Auth", details: "Failed login attempt for admin@expresswash.co.ke (5th attempt)", ip: "45.33.32.156", suspicious: true },
  { id: "AL-9005", timestamp: "2024-12-15 10:00:00", user: "Super Admin", role: "Super Admin", action: "UPDATE", entity: "Config", details: "Updated pricing rules for carpet cleaning", ip: "192.168.1.10", suspicious: false },
  { id: "AL-9006", timestamp: "2024-12-14 22:30:00", user: "Unknown", role: "--", action: "LOGIN_FAILED", entity: "Auth", details: "Brute force attempt detected from IP 103.45.67.89", ip: "103.45.67.89", suspicious: true },
  { id: "AL-9007", timestamp: "2024-12-14 16:20:00", user: "Jane Njeri", role: "Warehouse Staff", action: "UPDATE", entity: "Inventory", details: "Moved 3 items to quality check stage", ip: "192.168.1.55", suspicious: false },
  { id: "AL-9008", timestamp: "2024-12-14 15:00:00", user: "Admin User", role: "Admin", action: "DELETE", entity: "User", details: "Deactivated customer account u-107 (Faith Akinyi)", ip: "192.168.1.45", suspicious: false },
  { id: "AL-9009", timestamp: "2024-12-14 09:30:00", user: "Admin User", role: "Admin", action: "EXPORT", entity: "Report", details: "Exported financial report for November 2024", ip: "192.168.1.45", suspicious: false },
  { id: "AL-9010", timestamp: "2024-12-13 23:55:00", user: "Unknown", role: "--", action: "ACCESS_DENIED", entity: "Admin Panel", details: "Unauthorized access attempt to /admin/system-config", ip: "185.220.101.34", suspicious: true },
];

const actionColors: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  UPDATE: "bg-blue-100 text-blue-700 border-blue-200",
  DELETE: "bg-red-100 text-red-700 border-red-200",
  LOGIN_FAILED: "bg-yellow-100 text-yellow-700 border-yellow-200",
  ACCESS_DENIED: "bg-red-100 text-red-700 border-red-200",
  EXPORT: "bg-purple-100 text-purple-700 border-purple-200",
};

const auditColumns: Column<(typeof mockAuditLogs)[0]>[] = [
  { key: "timestamp", header: "Timestamp", sortable: true },
  { key: "user", header: "User", sortable: true },
  { key: "role", header: "Role" },
  {
    key: "action",
    header: "Action",
    render: (row) => (
      <Badge variant="outline" className={cn("text-xs font-medium", actionColors[row.action])}>
        {row.action}
      </Badge>
    ),
  },
  { key: "entity", header: "Entity", sortable: true },
  {
    key: "details",
    header: "Details",
    className: "max-w-xs",
    render: (row) => (
      <p className="text-sm text-muted-foreground truncate max-w-xs">{row.details}</p>
    ),
  },
  { key: "ip", header: "IP Address" },
];

/**
 * Admin Audit Logs Page
 * Filter bar, DataTable with suspicious entries highlighted.
 */
export const AuditLogs = () => {
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "2024-12-01", end: "2024-12-31" });

  const filteredLogs = mockAuditLogs.filter((log) => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (entityFilter !== "all" && log.entity !== entityFilter) return false;
    if (suspiciousOnly && !log.suspicious) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="Track all system activities and security events">
        <ExportButton data={filteredLogs} filename="audit-logs-export" />
      </PageHeader>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Action Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
            <SelectItem value="LOGIN_FAILED">Login Failed</SelectItem>
            <SelectItem value="ACCESS_DENIED">Access Denied</SelectItem>
            <SelectItem value="EXPORT">Export</SelectItem>
          </SelectContent>
        </Select>

        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Entity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="Order">Order</SelectItem>
            <SelectItem value="User">User</SelectItem>
            <SelectItem value="Auth">Auth</SelectItem>
            <SelectItem value="Config">Config</SelectItem>
            <SelectItem value="Inventory">Inventory</SelectItem>
            <SelectItem value="Report">Report</SelectItem>
            <SelectItem value="Admin Panel">Admin Panel</SelectItem>
          </SelectContent>
        </Select>

        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onRangeChange={(start, end) => setDateRange({ start, end })}
        />

        <div className="flex items-center gap-2">
          <Switch
            id="suspicious"
            checked={suspiciousOnly}
            onCheckedChange={setSuspiciousOnly}
          />
          <Label htmlFor="suspicious" className="text-sm cursor-pointer">
            Suspicious only
          </Label>
        </div>
      </div>

      {/* Audit Table - Suspicious entries get red left border */}
      <div className="space-y-0">
        <DataTable
          data={filteredLogs}
          columns={auditColumns}
          searchPlaceholder="Search logs..."
        />
      </div>
    </div>
  );
};

export default AuditLogs;
