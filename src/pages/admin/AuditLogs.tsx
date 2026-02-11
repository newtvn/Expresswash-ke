import { useState, useEffect, useCallback } from "react";
import { PageHeader, DataTable, ExportButton, DateRangePicker } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAuditLogs } from "@/services/auditService";
import type { AuditLogEntry } from "@/types";

const actionColors: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  UPDATE: "bg-blue-100 text-blue-700 border-blue-200",
  DELETE: "bg-red-100 text-red-700 border-red-200",
  LOGIN_FAILED: "bg-yellow-100 text-yellow-700 border-yellow-200",
  ACCESS_DENIED: "bg-red-100 text-red-700 border-red-200",
  EXPORT: "bg-purple-100 text-purple-700 border-purple-200",
};

// Map AuditLogEntry fields to flat keys for DataTable compatibility
interface AuditLogRow extends Record<string, unknown> {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  entity: string;
  details: string;
  ip: string;
  suspicious: boolean;
}

function toRow(entry: AuditLogEntry): AuditLogRow {
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    user: entry.userName,
    role: entry.userRole,
    action: entry.action,
    entity: entry.entity,
    details: entry.details,
    ip: entry.ipAddress,
    suspicious: entry.isSuspicious,
  };
}

const auditColumns: Column<AuditLogRow>[] = [
  { key: "timestamp", header: "Timestamp", sortable: true },
  { key: "user", header: "User", sortable: true },
  { key: "role", header: "Role" },
  {
    key: "action",
    header: "Action",
    render: (row) => (
      <Badge variant="outline" className={cn("text-xs font-medium", actionColors[row.action as string])}>
        {row.action as string}
      </Badge>
    ),
  },
  { key: "entity", header: "Entity", sortable: true },
  {
    key: "details",
    header: "Details",
    className: "max-w-xs",
    render: (row) => (
      <p className="text-sm text-muted-foreground truncate max-w-xs">{row.details as string}</p>
    ),
  },
  { key: "ip", header: "IP Address" },
];

function TableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Search bar skeleton */}
      <Skeleton className="h-10 w-72" />
      {/* Table skeleton */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 bg-muted/50 px-4 py-3">
          {auditColumns.map((col) => (
            <Skeleton key={col.key} className="h-4 flex-1" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-border">
            {auditColumns.map((col) => (
              <Skeleton key={col.key} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Admin Audit Logs Page
 * Filter bar, DataTable with suspicious entries highlighted.
 * Fetches real data from Supabase via auditService.
 */
export const AuditLogs = () => {
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAuditLogs({
        action: actionFilter !== "all" ? actionFilter : undefined,
        entity: entityFilter !== "all" ? entityFilter : undefined,
        isSuspicious: suspiciousOnly ? true : undefined,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
        page,
        limit,
      });
      setLogs(result.data.map(toRow));
      setTotal(result.total);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
      setError("Failed to load audit logs. Please try again.");
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, suspiciousOnly, dateRange.start, dateRange.end, page]);

  // Refetch whenever filters or page change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [actionFilter, entityFilter, suspiciousOnly, dateRange.start, dateRange.end]);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="Track all system activities and security events">
        <ExportButton data={logs} filename="audit-logs-export" />
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
            <SelectItem value="Delivery">Delivery</SelectItem>
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

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Audit Table - with loading skeleton */}
      <div className="space-y-0">
        {loading ? (
          <TableSkeleton />
        ) : (
          <DataTable
            data={logs}
            columns={auditColumns}
            searchPlaceholder="Search logs..."
            emptyMessage="No audit logs found matching the current filters."
          />
        )}
      </div>

      {/* Server-side pagination info */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Showing {((page - 1) * limit) + 1}--{Math.min(page * limit, total)} of {total} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} of {Math.ceil(total / limit)}
            </span>
            <button
              className="px-3 py-1 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
