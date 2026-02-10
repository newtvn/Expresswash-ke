import { supabase } from '@/lib/supabase';

// ── Driver types (local to this service) ──────────────────────────────

export type DriverStatus = 'available' | 'on_route' | 'on_break' | 'offline';

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  zone: string;
  status: DriverStatus;
  vehiclePlate: string;
  vehicleType: string;
  licenseNumber: string;
  isActive: boolean;
  isOnline: boolean;
  currentLocation?: { lat: number; lng: number; updatedAt: string };
  totalDeliveries: number;
  rating: number;
  joinedAt: string;
}

export interface DriverRoute {
  id: string;
  driverId: string;
  date: string;
  zone: string;
  stops: RouteStop[];
  totalDistance: number;
  estimatedDuration: number;
  status: 'planned' | 'in_progress' | 'completed';
}

export interface RouteStop {
  orderId: string;
  customerName: string;
  address: string;
  type: 'pickup' | 'delivery';
  scheduledTime: string;
  completedTime?: string;
  status: 'pending' | 'completed' | 'skipped';
}

export interface DriverPerformanceStats {
  driverId: string;
  driverName: string;
  totalDeliveries: number;
  onTimeRate: number;
  avgRating: number;
  totalFuelCost: number;
  avgDeliveriesPerDay: number;
  completedToday: number;
  activeRouteStops: number;
  customerComplaints: number;
  monthlyTrend: { month: string; deliveries: number; onTimeRate: number; revenue: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────

function mapDriver(row: Record<string, unknown>, profile: Record<string, unknown>): Driver {
  const loc = row.current_lat != null
    ? { lat: row.current_lat as number, lng: row.current_lng as number, updatedAt: row.location_updated_at as string }
    : undefined;

  return {
    id: row.id as string,
    name: (profile.full_name as string) ?? '',
    email: (profile.email as string) ?? '',
    phone: (profile.phone as string) ?? '',
    zone: (row.zone as string) ?? '',
    status: (row.status as DriverStatus) ?? 'offline',
    vehiclePlate: (row.vehicle_plate as string) ?? '',
    vehicleType: (row.vehicle_type as string) ?? '',
    licenseNumber: (row.license_number as string) ?? '',
    isActive: (row.is_active as boolean) ?? true,
    isOnline: (row.is_online as boolean) ?? false,
    currentLocation: loc,
    totalDeliveries: (row.total_deliveries as number) ?? 0,
    rating: (row.rating as number) ?? 0,
    joinedAt: (row.created_at as string) ?? '',
  };
}

function mapRoute(row: Record<string, unknown>, stops: Record<string, unknown>[]): DriverRoute {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    date: row.date as string,
    zone: (row.zone as string) ?? '',
    totalDistance: (row.total_distance as number) ?? 0,
    estimatedDuration: (row.estimated_duration as number) ?? 0,
    status: (row.status as DriverRoute['status']) ?? 'planned',
    stops: stops.map((s) => ({
      orderId: s.order_id as string,
      customerName: s.customer_name as string,
      address: s.address as string,
      type: s.type as 'pickup' | 'delivery',
      scheduledTime: s.scheduled_time as string,
      completedTime: (s.completed_time as string) ?? undefined,
      status: (s.status as RouteStop['status']) ?? 'pending',
    })),
  };
}

// ── Public API ────────────────────────────────────────────────────────

export const getDrivers = async (): Promise<Driver[]> => {
  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('*, profiles!drivers_id_fkey(full_name, email, phone)')
    .order('created_at', { ascending: false });

  if (error || !drivers) return [];

  return drivers.map((d) => {
    const profile = (d.profiles as Record<string, unknown>) ?? {};
    return mapDriver(d, profile);
  });
};

export const getDriverById = async (driverId: string): Promise<Driver | null> => {
  const { data: driver } = await supabase
    .from('drivers')
    .select('*, profiles!drivers_id_fkey(full_name, email, phone)')
    .eq('id', driverId)
    .single();

  if (!driver) return null;

  const profile = (driver.profiles as Record<string, unknown>) ?? {};
  return mapDriver(driver, profile);
};

export const getDriverRoutes = async (
  driverId: string,
  date?: string,
): Promise<DriverRoute[]> => {
  let query = supabase
    .from('driver_routes')
    .select('*')
    .eq('driver_id', driverId)
    .order('date', { ascending: false });

  if (date) {
    query = query.eq('date', date);
  }

  const { data: routes, error } = await query;
  if (error || !routes) return [];

  const routeIds = routes.map((r) => r.id);
  const { data: allStops } = await supabase
    .from('route_stops')
    .select('*')
    .in('route_id', routeIds);

  const stopsByRoute = (allStops ?? []).reduce<Record<string, Record<string, unknown>[]>>((acc, s) => {
    const rid = s.route_id as string;
    if (!acc[rid]) acc[rid] = [];
    acc[rid].push(s);
    return acc;
  }, {});

  return routes.map((r) => mapRoute(r, stopsByRoute[r.id] ?? []));
};

export const updateDriverStatus = async (
  id: string,
  status: DriverStatus,
): Promise<{ success: boolean; driver?: Driver }> => {
  const { error } = await supabase
    .from('drivers')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { success: false };

  const driver = await getDriverById(id);
  return { success: true, driver: driver ?? undefined };
};

export const getDriverPerformance = async (
  driverId: string,
): Promise<DriverPerformanceStats | null> => {
  const { data: stats } = await supabase
    .from('driver_performance_stats')
    .select('*')
    .eq('driver_id', driverId)
    .single();

  if (!stats) return null;

  const { data: trends } = await supabase
    .from('driver_monthly_trends')
    .select('*')
    .eq('driver_id', driverId)
    .order('month', { ascending: false })
    .limit(6);

  return {
    driverId: stats.driver_id as string,
    driverName: stats.driver_name as string,
    totalDeliveries: stats.total_deliveries as number,
    onTimeRate: stats.on_time_rate as number,
    avgRating: stats.avg_rating as number,
    totalFuelCost: stats.total_fuel_cost as number,
    avgDeliveriesPerDay: stats.avg_deliveries_per_day as number,
    completedToday: stats.completed_today as number,
    activeRouteStops: stats.active_route_stops as number,
    customerComplaints: stats.customer_complaints as number,
    monthlyTrend: (trends ?? []).map((t) => ({
      month: t.month as string,
      deliveries: t.deliveries as number,
      onTimeRate: t.on_time_rate as number,
      revenue: t.revenue as number,
    })),
  };
};

export const getAllRoutes = async (date?: string): Promise<DriverRoute[]> => {
  let query = supabase
    .from('driver_routes')
    .select('*')
    .order('date', { ascending: false });

  if (date) {
    query = query.eq('date', date);
  }

  const { data: routes, error } = await query;
  if (error || !routes) return [];

  const routeIds = routes.map((r) => r.id);
  const { data: allStops } = await supabase
    .from('route_stops')
    .select('*')
    .in('route_id', routeIds);

  const stopsByRoute = (allStops ?? []).reduce<Record<string, Record<string, unknown>[]>>((acc, s) => {
    const rid = s.route_id as string;
    if (!acc[rid]) acc[rid] = [];
    acc[rid].push(s);
    return acc;
  }, {});

  return routes.map((r) => mapRoute(r, stopsByRoute[r.id] ?? []));
};
