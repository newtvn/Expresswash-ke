import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, KPICard, DataTable, StatusBadge } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Truck, Star, MapPin, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { getDrivers } from "@/services/driverService";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/config/queryKeys";
import { useAuthStore } from "@/stores/authStore";

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
const VEHICLE_TYPES = ['car', 'van', 'truck', 'motorcycle'] as const;
const ZONES = ['Kitengela', 'Athi River', 'Syokimau', 'Mlolongo', 'Greater Nairobi'] as const;

const initialDriverForm = {
  name: '',
  email: '',
  phone: '',
  vehiclePlate: '',
  vehicleType: '',
  licenseNumber: '',
  zone: '',
  password: '',
};

export const DriverManagement = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: adminUser } = useAuthStore();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDriver, setNewDriver] = useState(initialDriverForm);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: queryKeys.drivers.list(),
    queryFn: getDrivers,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const handleCreateDriver = async () => {
    if (!newDriver.name || !newDriver.email || !newDriver.password) {
      toast.error('Name, email and password are required');
      return;
    }
    if (!newDriver.vehiclePlate || !newDriver.vehicleType) {
      toast.error('Vehicle plate and vehicle type are required');
      return;
    }
    setCreating(true);
    try {
      // Call edge function which uses service_role to create user
      // (no Supabase confirmation email sent, custom welcome email queued instead)
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email: newDriver.email,
            password: newDriver.password,
            name: newDriver.name,
            phone: newDriver.phone,
            role: 'driver',
            zone: newDriver.zone,
            driverDetails: {
              vehiclePlate: newDriver.vehiclePlate,
              vehicleType: newDriver.vehicleType,
              licenseNumber: newDriver.licenseNumber,
            },
          }),
        },
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(result.error ?? 'Failed to create driver');
        return;
      }

      toast.success(`Driver ${newDriver.name} created successfully`);
      setAddDialogOpen(false);
      setNewDriver(initialDriverForm);
      setShowPassword(false);
      qc.invalidateQueries({ queryKey: queryKeys.drivers.all });
    } finally {
      setCreating(false);
    }
  };

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
        <Button onClick={() => setAddDialogOpen(true)}>
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
        onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
      />

      {/* Add Driver Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Driver</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Full Name *</Label><Input value={newDriver.name} onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })} placeholder="John Doe" /></div>
            <div><Label>Email *</Label><Input type="email" value={newDriver.email} onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })} placeholder="john@example.com" /></div>
            <div>
              <Label>Password *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newDriver.password}
                  onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div><Label>Phone</Label><Input value={newDriver.phone} onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })} placeholder="+254 7XX XXX XXX" /></div>
            <div><Label>Vehicle Plate *</Label><Input value={newDriver.vehiclePlate} onChange={(e) => setNewDriver({ ...newDriver, vehiclePlate: e.target.value })} placeholder="KAA 123A" /></div>
            <div>
              <Label>Vehicle Type *</Label>
              <Select value={newDriver.vehicleType} onValueChange={(v) => setNewDriver({ ...newDriver, vehicleType: v })}>
                <SelectTrigger><SelectValue placeholder="Select vehicle type" /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>License Number</Label><Input value={newDriver.licenseNumber} onChange={(e) => setNewDriver({ ...newDriver, licenseNumber: e.target.value })} placeholder="DL-12345678" /></div>
            <div>
              <Label>Zone</Label>
              <Select value={newDriver.zone} onValueChange={(v) => setNewDriver({ ...newDriver, zone: v })}>
                <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>
                  {ZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateDriver} disabled={creating}>{creating ? 'Creating...' : 'Create Driver'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverManagement;
