import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, ExportButton, DateRangePicker } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSystemLogs } from "@/services/auditService";
import type { SystemLogFilters } from "@/types";

const levelStyles: Record<string, string> = {
  info: "bg-blue-100 text-blue-700 border-blue-200",
  warn: "bg-yellow-100 text-yellow-700 border-yellow-200",
  error: "bg-red-100 text-red-700 border-red-200",
  debug: "bg-gray-100 text-gray-600 border-gray-200",
};

/**
 * Admin System Logs Page
 * Log viewer with level filters, service dropdown, search, and auto-refresh toggle.
 * Connected to real Supabase system logs.
 */
export const SystemLogs = () => {
  const [levels, setLevels] = useState({
    info: true,
    warn: true,
    error: true,
    debug: false,
  });
  const [serviceFilter, setServiceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  const [page] = useState(1);

  const toggleLevel = (level: string) => {
    setLevels((prev) => ({ ...prev, [level]: !prev[level as keyof typeof prev] }));
  };

  // Build filters for API call
  const filters: SystemLogFilters = {
    startDate: dateRange.start,
    endDate: dateRange.end,
    service: serviceFilter !== "all" ? serviceFilter : undefined,
    search: search || undefined,
    page,
    limit: 100,
  };

  // Fetch logs with filters
  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['systemLogs', filters],
    queryFn: () => getSystemLogs(filters),
    staleTime: autoRefresh ? 5000 : 2 * 60 * 1000, // 5s if auto-refresh, else 2 minutes
    refetchInterval: autoRefresh ? 10000 : false, // Auto-refresh every 10s if enabled
  });

  const logs = logsData?.data || [];

  // Extract unique services from logs
  const services = [...new Set(logs.map((l) => l.service))];

  // Client-side level filtering (since API doesn't support multiple levels)
  const filteredLogs = logs.filter((log) => {
    if (!levels[log.level as keyof typeof levels]) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="System Logs" description="Monitor application logs and system events" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="System Logs" description="Monitor application logs and system events">
        <Button
          variant={autoRefresh ? "default" : "outline"}
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", autoRefresh && "animate-spin")} />
          {autoRefresh ? "Auto-Refreshing" : "Auto-Refresh"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
        <ExportButton data={filteredLogs} filename="system-logs-export" />
      </PageHeader>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Level Checkboxes */}
        <div className="flex items-center gap-3">
          {(["info", "warn", "error", "debug"] as const).map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <Checkbox
                id={`level-${level}`}
                checked={levels[level]}
                onCheckedChange={() => toggleLevel(level)}
              />
              <Label htmlFor={`level-${level}`} className="text-sm cursor-pointer capitalize">
                <Badge variant="outline" className={cn("text-xs", levelStyles[level])}>
                  {level}
                </Badge>
              </Label>
            </div>
          ))}
        </div>

        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {services.map((service) => (
              <SelectItem key={service} value={service}>
                {service}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onRangeChange={(start, end) => setDateRange({ start, end })}
        />
      </div>

      {/* Log Entries */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No log entries match the current filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Timestamp</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 w-20">Level</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 w-36">Service</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                      {new Date(log.timestamp).toLocaleString('en-KE')}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={cn("text-[10px] uppercase font-semibold", levelStyles[log.level])}>
                        {log.level}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium text-foreground">{log.service}</span>
                    </td>
                    <td className="px-4 py-2.5 text-foreground text-xs">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Showing {filteredLogs.length} of {logs.length} log entries
      </p>
    </div>
  );
};

export default SystemLogs;
