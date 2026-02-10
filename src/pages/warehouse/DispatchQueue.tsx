import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PackageCheck, Truck, MapPin, Clock, CheckCircle2 } from "lucide-react";

const dispatchStats = [
  { label: "Ready to Dispatch", value: "15", icon: PackageCheck, color: "bg-primary/10 text-primary" },
  { label: "Awaiting Driver", value: "8", icon: Clock, color: "bg-amber-100 text-amber-600" },
  { label: "Dispatched Today", value: "12", icon: Truck, color: "bg-blue-100 text-blue-600" },
  { label: "Delivered Today", value: "9", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600" },
];

const mockDispatchItems = [
  { id: "ITM-4001", orderId: "EW-2024-01279", customer: "David Maina", items: "2 Carpets", zone: "Athi River", driver: "Samuel Otieno", status: "ready_for_dispatch", readySince: "2024-12-15 10:00" },
  { id: "ITM-4002", orderId: "EW-2024-01275", customer: "Brian Otieno", items: "1 Sofa, 1 Rug", zone: "Nairobi", driver: "Daniel Kiprop", status: "ready_for_dispatch", readySince: "2024-12-15 09:30" },
  { id: "ITM-4003", orderId: "EW-2024-01270", customer: "Grace Wanjiku", items: "3 Curtain Pairs", zone: "Kitengela", driver: "Joseph Mwangi", status: "ready_for_dispatch", readySince: "2024-12-15 08:00" },
  { id: "ITM-4004", orderId: "EW-2024-01268", customer: "Peter Kamau", items: "1 Mattress", zone: "Athi River", driver: "--", status: "ready_for_dispatch", readySince: "2024-12-15 07:30" },
  { id: "ITM-4005", orderId: "EW-2024-01265", customer: "Mary Njeri", items: "2 Chairs", zone: "Kitengela", driver: "--", status: "ready_for_dispatch", readySince: "2024-12-14 16:00" },
  { id: "ITM-4006", orderId: "EW-2024-01260", customer: "Sarah Wambui", items: "1 Carpet (Large)", zone: "Kitengela", driver: "Patrick Njoroge", status: "dispatched", readySince: "2024-12-14 14:00" },
  { id: "ITM-4007", orderId: "EW-2024-01258", customer: "John Odera", items: "1 Rug, 1 Chair", zone: "Nairobi", driver: "Daniel Kiprop", status: "dispatched", readySince: "2024-12-14 12:00" },
  { id: "ITM-4008", orderId: "EW-2024-01255", customer: "Ann Chebet", items: "1 Sofa (3-Seater)", zone: "Athi River", driver: "Brian Ochieng", status: "out_for_delivery", readySince: "2024-12-14 10:00" },
];

const dispatchColumns: Column<(typeof mockDispatchItems)[0]>[] = [
  { key: "orderId", header: "Order", sortable: true },
  { key: "customer", header: "Customer", sortable: true },
  { key: "items", header: "Items" },
  {
    key: "zone",
    header: "Zone",
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-1">
        <MapPin className="w-3 h-3 text-muted-foreground" />
        <span>{row.zone}</span>
      </div>
    ),
  },
  {
    key: "driver",
    header: "Driver",
    render: (row) => (
      <span className={row.driver === "--" ? "text-muted-foreground" : "font-medium"}>
        {row.driver === "--" ? "Unassigned" : row.driver}
      </span>
    ),
  },
  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  { key: "readySince", header: "Ready Since", sortable: true },
  {
    key: "id",
    header: "Actions",
    render: (row) => {
      if (row.status === "ready_for_dispatch" && row.driver === "--") {
        return (
          <Button variant="outline" size="sm">
            Assign Driver
          </Button>
        );
      }
      if (row.status === "ready_for_dispatch" && row.driver !== "--") {
        return (
          <Button size="sm">
            <Truck className="w-4 h-4 mr-1" />
            Dispatch
          </Button>
        );
      }
      return <span className="text-xs text-muted-foreground">--</span>;
    },
  },
];

/**
 * Warehouse Dispatch Queue Page
 * Ready-for-dispatch table with assign/dispatch actions.
 */
const DispatchQueue = () => {
  return (
    <div className="space-y-6">
      <PageHeader title="Dispatch Queue" description="Manage items ready for delivery" />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dispatchStats.map((stat) => (
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

      {/* Dispatch Table */}
      <DataTable
        data={mockDispatchItems}
        columns={dispatchColumns}
        searchPlaceholder="Search dispatch items..."
      />
    </div>
  );
};

export default DispatchQueue;
