import { PageHeader, KPICard, DataTable, StatusBadge } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { UserPlus, Truck, Star, MapPin, CheckCircle2 } from "lucide-react";

const performanceKPIs = [
  { label: "Total Drivers", value: 0, change: 0, changeDirection: "flat" as const, icon: Truck, format: "number" as const },
  { label: "Active Today", value: 0, change: 0, changeDirection: "flat" as const, icon: CheckCircle2, format: "number" as const },
  { label: "Avg Rating", value: 0, change: 0, changeDirection: "flat" as const, icon: Star, format: "number" as const },
  { label: "Zones Covered", value: 0, change: 0, changeDirection: "flat" as const, icon: MapPin, format: "number" as const },
];

type Driver = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  zone: string;
  deliveries: number;
  rating: number;
  status: string;
};

const driverColumns: Column<Driver>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "phone", header: "Phone" },
  { key: "vehicle", header: "Vehicle" },
  { key: "zone", header: "Zone", sortable: true },
  { key: "deliveries", header: "Deliveries", sortable: true, render: (row) => <span className="font-medium">{row.deliveries}</span> },
  {
    key: "rating",
    header: "Rating",
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
        <span className="font-medium">{row.rating}</span>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge status={row.status} />,
  },
];

/**
 * Admin Driver Management Page
 * Driver roster table with performance stats.
 * TODO: Connect to real driver service
 */
export const DriverManagement = () => {
  // TODO: Fetch drivers from Supabase
  const drivers: Driver[] = [];

  return (
    <div className="space-y-6">
      <PageHeader title="Driver Management" description="Manage your delivery fleet and track performance">
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Driver
        </Button>
      </PageHeader>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceKPIs.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Driver Table */}
      <DataTable
        data={drivers}
        columns={driverColumns}
        searchPlaceholder="Search drivers..."
      />
    </div>
  );
};

export default DriverManagement;
