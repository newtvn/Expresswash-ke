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

const mockLogs = [
  { id: 1, timestamp: "2024-12-15 14:32:15.123", level: "info", service: "OrderService", message: "Order EW-2024-01284 status updated to in_washing" },
  { id: 2, timestamp: "2024-12-15 14:32:14.998", level: "debug", service: "QueueWorker", message: "Processing job #45892 for order EW-2024-01284" },
  { id: 3, timestamp: "2024-12-15 14:30:05.456", level: "info", service: "AuthService", message: "User admin@expresswash.co.ke logged in from 192.168.1.45" },
  { id: 4, timestamp: "2024-12-15 14:28:00.789", level: "info", service: "OrderService", message: "New order EW-2024-01284 created by customer Grace Wanjiku" },
  { id: 5, timestamp: "2024-12-15 14:15:30.012", level: "warn", service: "PaymentService", message: "M-Pesa callback timeout for transaction RLK456789, retrying..." },
  { id: 6, timestamp: "2024-12-15 14:10:22.345", level: "error", service: "SMSService", message: "Failed to send SMS to +254711000004: Gateway timeout after 30s" },
  { id: 7, timestamp: "2024-12-15 14:05:11.678", level: "info", service: "DriverService", message: "Driver Joseph Mwangi location updated: -1.4812, 36.9634" },
  { id: 8, timestamp: "2024-12-15 13:55:00.901", level: "debug", service: "CacheService", message: "Cache miss for key order:EW-2024-01282, fetching from DB" },
  { id: 9, timestamp: "2024-12-15 13:45:30.234", level: "info", service: "DeliveryService", message: "Delivery EW-2024-01280 marked as completed by driver d-1" },
  { id: 10, timestamp: "2024-12-15 13:40:15.567", level: "warn", service: "InventoryService", message: "Item ITM-4009 has been in warehouse for 5 days (threshold: 3 days)" },
  { id: 11, timestamp: "2024-12-15 13:30:00.890", level: "error", service: "EmailService", message: "SMTP connection failed: Connection refused to mail.expresswash.co.ke:587" },
  { id: 12, timestamp: "2024-12-15 13:25:45.123", level: "info", service: "AuthService", message: "Password reset requested for customer@test.com" },
  { id: 13, timestamp: "2024-12-15 13:20:00.456", level: "debug", service: "AnalyticsService", message: "Daily report generation started for 2024-12-14" },
  { id: 14, timestamp: "2024-12-15 13:15:30.789", level: "warn", service: "RateLimiter", message: "Rate limit warning: IP 45.33.32.156 approaching threshold (80/100)" },
  { id: 15, timestamp: "2024-12-15 13:10:00.012", level: "error", service: "AuthService", message: "Brute force detection: 5 failed login attempts from 45.33.32.156 in 60s" },
  { id: 16, timestamp: "2024-12-15 13:00:00.345", level: "info", service: "SchedulerService", message: "Cron job [send-pickup-reminders] executed successfully, 12 reminders sent" },
];

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

  const services = [...new Set(mockLogs.map((l) => l.service))];

  const filteredLogs = mockLogs.filter((log) => {
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
        Showing {filteredLogs.length} of {mockLogs.length} log entries
      </p>
    </div>
  );
};

export default SystemLogs;
