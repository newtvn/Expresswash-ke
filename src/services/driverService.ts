import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';

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
  id?: string;
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

export interface DriverPage {
  rows: Driver[];
  total: number;
}

export interface DriverRosterStats {
  totalDrivers: number;
  activeToday: number;
  averageRating: number;
  zonesCovered: number;
}

// ── Helpers ───────────────────────────────────────────────────────────

function mapDriver(row: Record<string, unknown>, profile: Record<string, unknown>): Driver {
  const loc = row.current_lat != null
    ? { lat: row.current_lat as number, lng: row.current_lng as number, updatedAt: row.location_updated_at as string }
    : undefined;

  // profiles table uses 'name' not 'full_name'
  return {
    id: (row.id as string) || (profile.id as string) || '',
    name: (profile.name as string) ?? '',
    email: (profile.email as string) ?? '',
    phone: (profile.phone as string) ?? '',
    zone: (row.zone as string) ?? (profile.zone as string) ?? '',
    status: (row.status as DriverStatus) ?? 'offline',
    vehiclePlate: (row.vehicle_plate as string) ?? '',
    vehicleType: (row.vehicle_type as string) ?? '',
    licenseNumber: (row.license_number as string) ?? '',
    isActive: (profile.is_active as boolean) ?? true,
    isOnline: (row.is_online as boolean) ?? false,
    currentLocation: loc,
    totalDeliveries: (row.total_deliveries as number) ?? 0,
    rating: (row.rating as number) ?? 0,
    joinedAt: (row.joined_at as string) ?? (profile.created_at as string) ?? '',
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
      id: (s.id as string) ?? undefined,
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

/** Full driver roster for small reference-data controls such as assignment dropdowns. */
export const getDrivers = async (): Promise<Driver[]> => {
  const { data: profiles, error: pErr } = await retrySupabaseQuery(
    () => supabase.from('profiles').select('*').eq('role', 'driver').order('name'),
    { maxRetries: 2 },
  );

  if (pErr || !profiles || profiles.length === 0) return [];

  const ids = profiles.map((profile) => profile.id as string);
  const { data: driverRows } = await retrySupabaseQuery(
    () => supabase.from('drivers').select('*').in('id', ids),
    { maxRetries: 2 },
  );

  const driverMap: Record<string, Record<string, unknown>> = {};
  (driverRows ?? []).forEach((driver) => { driverMap[driver.id as string] = driver; });

  return profiles.map((profile) => (
    mapDriver(driverMap[profile.id as string] ?? {}, profile as Record<string, unknown>)
  ));
};

export const getDriversPage = async (params: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<DriverPage> => {
  const from = params.page * params.pageSize;
  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .eq('role', 'driver')
    .order('name')
    .range(from, from + params.pageSize - 1);

  const term = (params.search ?? '').trim();
  if (term) query = query.ilike('name', `%${term}%`);

  const { data: profiles, count, error: pErr } = await query;

  if (pErr || !profiles) return { rows: [], total: count ?? 0 };

  if (profiles.length === 0) return { rows: [], total: count ?? 0 };

  const ids = profiles.map((p) => p.id as string);
  const { data: driverRows } = await retrySupabaseQuery(
    () => supabase.from('drivers').select('*').in('id', ids),
    { maxRetries: 2 }
  );

  const driverMap: Record<string, Record<string, unknown>> = {};
  (driverRows ?? []).forEach((d) => { driverMap[d.id as string] = d; });

  return {
    rows: profiles.map((p) => mapDriver(driverMap[p.id as string] ?? {}, p as Record<string, unknown>)),
    total: count ?? 0,
  };
};

/** Lightweight whole-roster data for the KPI cards, independent of the current page. */
export const getDriverRosterStats = async (): Promise<DriverRosterStats> => {
  const { data: profiles, count, error: pErr } = await supabase
    .from('profiles')
    .select('id, zone', { count: 'exact' })
    .eq('role', 'driver');

  if (pErr || !profiles) {
    return { totalDrivers: 0, activeToday: 0, averageRating: 0, zonesCovered: 0 };
  }

  if (profiles.length === 0) {
    return { totalDrivers: count ?? 0, activeToday: 0, averageRating: 0, zonesCovered: 0 };
  }

  const driverIds = profiles.map((profile) => profile.id as string);
  const { data: driverRows } = await retrySupabaseQuery(
    () => supabase
      .from('drivers')
      .select('id, status, is_online, rating')
      .in('id', driverIds),
    { maxRetries: 2 },
  );

  const rows = driverRows ?? [];
  const totalDrivers = count ?? profiles.length;
  const activeToday = rows.filter((row) => row.is_online && row.status !== 'offline').length;
  const ratingTotal = rows.reduce((sum, row) => sum + ((row.rating as number) ?? 0), 0);
  const zonesCovered = new Set(
    profiles
      .map((profile) => (profile.zone as string) || '')
      .filter(Boolean),
  ).size;

  return {
    totalDrivers,
    activeToday,
    averageRating: totalDrivers > 0 ? ratingTotal / totalDrivers : 0,
    zonesCovered,
  };
};

export const getDriverById = async (driverId: string): Promise<Driver | null> => {
  const { data: profile } = await retrySupabaseQuery(
    () => supabase.from('profiles').select('*').eq('id', driverId).single(),
    { maxRetries: 2 }
  );
  if (!profile) return null;
  const { data: driverRow } = await retrySupabaseQuery(
    () => supabase.from('drivers').select('*').eq('id', driverId).maybeSingle(),
    { maxRetries: 2 }
  );
  return mapDriver((driverRow ?? {}) as Record<string, unknown>, profile as Record<string, unknown>);
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

  const { data: routes, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });
  if (error || !routes) return [];

  const routeIds = routes.map((r) => r.id);
  const { data: allStops } = await retrySupabaseQuery(
    () => supabase.from('route_stops').select('*').in('route_id', routeIds),
    { maxRetries: 2 }
  );

  const stopsByRoute = (allStops ?? []).reduce<Record<string, Record<string, unknown>[]>>((acc, s) => {
    const rid = s.route_id as string;
    if (!acc[rid]) acc[rid] = [];
    acc[rid].push(s);
    return acc;
  }, {});

  return routes.map((r) => mapRoute(r, stopsByRoute[r.id] ?? []));
};

/**
 * Return every unfinished route for a driver, including routes created on a
 * previous day. Delivery work can legitimately cross midnight and must remain
 * actionable until its final stop is completed.
 */
export const getDriverActiveRoutes = async (driverId: string): Promise<DriverRoute[]> => {
  const { data: routes, error } = await retrySupabaseQuery(
    () => supabase
      .from('driver_routes')
      .select('*')
      .eq('driver_id', driverId)
      .neq('status', 'completed')
      .order('date', { ascending: false }),
    { maxRetries: 2 }
  );

  if (error || !routes || routes.length === 0) return [];

  const routeIds = routes.map((route) => route.id);
  const { data: pendingStops } = await retrySupabaseQuery(
    () => supabase
      .from('route_stops')
      .select('*')
      .in('route_id', routeIds)
      .eq('status', 'pending'),
    { maxRetries: 2 }
  );

  const stopsByRoute = (pendingStops ?? []).reduce<Record<string, Record<string, unknown>[]>>((acc, stop) => {
    const routeId = stop.route_id as string;
    if (!acc[routeId]) acc[routeId] = [];
    acc[routeId].push(stop);
    return acc;
  }, {});

  return routes
    .map((route) => mapRoute(route, stopsByRoute[route.id] ?? []))
    .filter((route) => route.stops.length > 0);
};

export const updateDriverStatus = async (
  id: string,
  status: DriverStatus,
): Promise<{ success: boolean; driver?: Driver }> => {
  const isOnline = status !== 'offline';
  const { error } = await supabase
    .from('drivers')
    .upsert({ id, status, is_online: isOnline })
    .eq('id', id);

  if (error) return { success: false };

  const driver = await getDriverById(id);
  return { success: true, driver: driver ?? undefined };
};

export const completeRouteStop = async (
  stopId: string,
): Promise<{ success: boolean }> => {
  const { data, error } = await supabase.rpc('complete_own_route_stop', {
    p_stop_id: stopId,
  });

  return { success: !error && data === true };
};

export const transitionOwnDeliveryStop = async (
  stopId: string,
  targetStatus: 11 | 12,
): Promise<{ success: boolean }> => {
  const { data, error } = await supabase.rpc('transition_own_delivery_stop', {
    p_stop_id: stopId,
    p_target_status: targetStatus,
  });

  return { success: !error && data === true };
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

  const { data: routes, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });
  if (error || !routes) return [];

  const routeIds = routes.map((r) => r.id);
  const { data: allStops } = await retrySupabaseQuery(
    () => supabase.from('route_stops').select('*').in('route_id', routeIds),
    { maxRetries: 2 }
  );

  const stopsByRoute = (allStops ?? []).reduce<Record<string, Record<string, unknown>[]>>((acc, s) => {
    const rid = s.route_id as string;
    if (!acc[rid]) acc[rid] = [];
    acc[rid].push(s);
    return acc;
  }, {});

  return routes.map((r) => mapRoute(r, stopsByRoute[r.id] ?? []));
};
