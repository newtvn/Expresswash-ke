import { useState } from "react";
import { PageHeader, ExportButton, DateRangePicker } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const levelStyles: Record<string, string> = {
  info: "bg-blue-100 text-blue-700 border-blue-200",
  warn: "bg-yellow-100 text-yellow-700 border-yellow-200",
  error: "bg-red-100 text-red-700 border-red-200",
  debug: "bg-gray-100 text-gray-600 border-gray-200",
};

type Log = {
  id: number;
  timestamp: string;
  level: string;
  service: string;
  message: string;
};

// TODO: Connect to real system logs service
const logs: Log[] = [];

/**
 * Admin System Logs Page
 * Log viewer with level filters, service dropdown, search, and auto-refresh toggle.
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
  const [dateRange, setDateRange] = useState({ start: "2024-12-15", end: "2024-12-15" });

  const toggleLevel = (level: string) => {
    setLevels((prev) => ({ ...prev, [level]: !prev[level as keyof typeof prev] }));
  };

  const services = [...new Set(logs.map((l) => l.service))];

  const filteredLogs = logs.filter((log) => {
    if (!levels[log.level as keyof typeof levels]) return false;
    if (serviceFilter !== "all" && log.service !== serviceFilter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
      <div className="bg-gray-950 rounded-lg border border-border overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto p-4 space-y-1">
          {filteredLogs.length === 0 ? (
            <p className="text-gray-500 text-center py-8 font-mono text-sm">
              No log entries match the current filters
            </p>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 py-1.5 px-2 rounded hover:bg-gray-900/50 transition-colors font-mono text-sm"
              >
                <span className="text-gray-500 whitespace-nowrap text-xs">
                  {log.timestamp}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase font-bold px-1.5 py-0 min-w-[50px] text-center",
                    levelStyles[log.level]
                  )}
                >
                  {log.level}
                </Badge>
                <span className="text-primary/80 whitespace-nowrap text-xs">
                  [{log.service}]
                </span>
                <span className="text-gray-300 text-xs flex-1">
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Showing {filteredLogs.length} of {logs.length} log entries
      </p>
    </div>
  );
};

export default SystemLogs;
