import { PageHeader, KPICard, DataTable, StatusBadge } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { UserPlus, Truck, Star, MapPin, CheckCircle2 } from "lucide-react";

const performanceKPIs = [
  { label: "Total Drivers", value: 12, change: 2, changeDirection: "up" as const, icon: Truck, format: "number" as const },
  { label: "Active Today", value: 9, change: 0, changeDirection: "flat" as const, icon: CheckCircle2, format: "number" as const },
  { label: "Avg Rating", value: 4.7, change: 3.1, changeDirection: "up" as const, icon: Star, format: "number" as const },
  { label: "Zones Covered", value: 3, change: 0, changeDirection: "flat" as const, icon: MapPin, format: "number" as const },
];

const mockDrivers = [
  { id: "d-1", name: "Joseph Mwangi", phone: "+254712345678", vehicle: "Toyota Probox (KDA 123A)", zone: "Kitengela", deliveries: 342, rating: 4.8, status: "active" },
  { id: "d-2", name: "Brian Ochieng", phone: "+254712345679", vehicle: "Nissan NV200 (KDB 456B)", zone: "Athi River", deliveries: 278, rating: 4.6, status: "active" },
  { id: "d-3", name: "Daniel Kiprop", phone: "+254712345680", vehicle: "Toyota Hiace (KDC 789C)", zone: "Nairobi", deliveries: 195, rating: 4.9, status: "active" },
  { id: "d-4", name: "Michael Karanja", phone: "+254712345681", vehicle: "Suzuki Every (KDD 012D)", zone: "Kitengela", deliveries: 156, rating: 4.3, status: "inactive" },
  { id: "d-5", name: "Samuel Otieno", phone: "+254712345682", vehicle: "Toyota Probox (KDE 345E)", zone: "Athi River", deliveries: 420, rating: 4.7, status: "active" },
  { id: "d-6", name: "Patrick Njoroge", phone: "+254712345683", vehicle: "Nissan NV200 (KDF 678F)", zone: "Kitengela", deliveries: 310, rating: 4.5, status: "active" },
  { id: "d-7", name: "Stephen Waweru", phone: "+254712345684", vehicle: "Toyota Hiace (KDG 901G)", zone: "Nairobi", deliveries: 88, rating: 4.2, status: "active" },
  { id: "d-8", name: "George Mutua", phone: "+254712345685", vehicle: "Suzuki Every (KDH 234H)", zone: "Athi River", deliveries: 250, rating: 4.8, status: "active" },
];

const driverColumns: Column<(typeof mockDrivers)[0]>[] = [
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
 */
export const DriverManagement = () => {
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
        data={mockDrivers}
        columns={driverColumns}
        searchPlaceholder="Search drivers..."
      />
    </div>
  );
};

export default DriverManagement;
