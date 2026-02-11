import { useQuery } from "@tanstack/react-query";
import { PageHeader, KPICard, DataTable, StatusBadge } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Truck, Star, MapPin, CheckCircle2 } from "lucide-react";
import { getDrivers } from "@/services/driverService";
import { queryKeys } from "@/config/queryKeys";

type DriverTableRow = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  zone: string;
  deliveries: number;
  rating: number;
  status: string;
};

const driverColumns: Column<DriverTableRow>[] = [
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
        <span className="font-medium">{row.rating.toFixed(1)}</span>
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
 * Connected to real Supabase driver data.
 */
export const DriverManagement = () => {
  const { data: drivers = [], isLoading } = useQuery({
    queryKey: queryKeys.drivers.list(),
    queryFn: getDrivers,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Calculate KPIs from driver data
  const totalDrivers = drivers.length;
  const activeToday = drivers.filter((d) => d.isOnline && d.status !== 'offline').length;
  const avgRating = drivers.length > 0
    ? drivers.reduce((sum, d) => sum + d.rating, 0) / drivers.length
    : 0;
  const uniqueZones = new Set(drivers.map((d) => d.zone).filter(Boolean)).size;

  const performanceKPIs = [
    { label: "Total Drivers", value: totalDrivers, change: 0, changeDirection: "flat" as const, icon: Truck, format: "number" as const },
    { label: "Active Today", value: activeToday, change: 0, changeDirection: "flat" as const, icon: CheckCircle2, format: "number" as const },
    { label: "Avg Rating", value: avgRating, change: 0, changeDirection: "flat" as const, icon: Star, format: "decimal" as const },
    { label: "Zones Covered", value: uniqueZones, change: 0, changeDirection: "flat" as const, icon: MapPin, format: "number" as const },
  ];

  // Transform drivers to table rows
  const tableData: DriverTableRow[] = drivers.map((driver) => ({
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    vehicle: `${driver.vehicleType} - ${driver.vehiclePlate}`,
    zone: driver.zone || 'N/A',
    deliveries: driver.totalDeliveries,
    rating: driver.rating,
    status: driver.status,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Driver Management" description="Manage your delivery fleet and track performance" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

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
        data={tableData}
        columns={driverColumns}
        searchPlaceholder="Search drivers..."
      />
    </div>
  );
};

export default DriverManagement;
