import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

import {
  completeRouteStop,
  getDriverActiveRoutes,
  getDriverRosterStats,
  getDriversPage,
  transitionOwnDeliveryStop,
} from '@/services/driverService';

describe('driverService.getDriversPage', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('pages and searches driver profiles before loading details for that page', async () => {
    const profileIlike = vi.fn().mockResolvedValue({
      data: [{
        id: 'driver-1',
        name: 'Jane Driver',
        email: 'jane@example.com',
        phone: '+254700000001',
        zone: 'Kitengela',
        is_active: true,
        created_at: '2026-09-01T00:00:00Z',
      }],
      count: 31,
      error: null,
    });
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      ilike: profileIlike,
    };
    const driverIn = vi.fn().mockResolvedValue({
      data: [{
        id: 'driver-1',
        zone: 'Kitengela',
        status: 'available',
        is_online: true,
        vehicle_plate: 'KAA 123A',
        vehicle_type: 'van',
        total_deliveries: 42,
        rating: 4.8,
      }],
      error: null,
    });
    const driverQuery = {
      select: vi.fn().mockReturnThis(),
      in: driverIn,
    };

    mockFrom.mockImplementation((table: string) => (
      table === 'profiles' ? profileQuery : driverQuery
    ));

    const result = await getDriversPage({ page: 2, pageSize: 15, search: ' Jane ' });

    expect(profileQuery.select).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(profileQuery.eq).toHaveBeenCalledWith('role', 'driver');
    expect(profileQuery.order).toHaveBeenCalledWith('name');
    expect(profileQuery.range).toHaveBeenCalledWith(30, 44);
    expect(profileIlike).toHaveBeenCalledWith('name', '%Jane%');
    expect(driverIn).toHaveBeenCalledWith('id', ['driver-1']);
    expect(result.total).toBe(31);
    expect(result.rows[0]).toMatchObject({
      id: 'driver-1',
      name: 'Jane Driver',
      vehiclePlate: 'KAA 123A',
      totalDeliveries: 42,
    });
  });

  it('calculates roster-wide KPIs independently of the current page', async () => {
    const profileEq = vi.fn().mockResolvedValue({
      data: [
        { id: 'driver-1', zone: 'Kitengela' },
        { id: 'driver-2', zone: 'Athi River' },
        { id: 'driver-3', zone: 'Syokimau' },
      ],
      count: 3,
      error: null,
    });
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: profileEq,
    };
    const driverIn = vi.fn().mockResolvedValue({
      data: [
        { id: 'driver-1', status: 'available', is_online: true, rating: 4.5 },
        { id: 'driver-2', status: 'offline', is_online: false, rating: 3 },
      ],
      error: null,
    });
    const driverQuery = {
      select: vi.fn().mockReturnThis(),
      in: driverIn,
    };

    mockFrom.mockImplementation((table: string) => (
      table === 'profiles' ? profileQuery : driverQuery
    ));

    await expect(getDriverRosterStats()).resolves.toEqual({
      totalDrivers: 3,
      activeToday: 1,
      averageRating: 2.5,
      zonesCovered: 3,
    });
    expect(profileQuery.select).toHaveBeenCalledWith('id, zone', { count: 'exact' });
    expect(profileEq).toHaveBeenCalledWith('role', 'driver');
    expect(driverIn).toHaveBeenCalledWith('id', ['driver-1', 'driver-2', 'driver-3']);
  });
});

describe('driverService.getDriverActiveRoutes', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('loads pending stops from unfinished routes without restricting them to today', async () => {
    const routeOrder = vi.fn().mockResolvedValue({
      data: [{
        id: 'route-yesterday',
        driver_id: 'driver-1',
        date: '2026-09-10',
        zone: 'Kitengela',
        status: 'in_progress',
      }],
      error: null,
    });
    const routeQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: routeOrder,
    };

    const stopEq = vi.fn().mockResolvedValue({
      data: [{
        id: 'stop-1',
        route_id: 'route-yesterday',
        order_id: 'order-1',
        customer_name: 'QA Customer',
        address: 'QA Address',
        type: 'delivery',
        scheduled_time: '2026-09-10T18:00:00Z',
        status: 'pending',
      }],
      error: null,
    });
    const stopQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: stopEq,
    };

    mockFrom.mockImplementation((table: string) => (
      table === 'driver_routes' ? routeQuery : stopQuery
    ));

    const routes = await getDriverActiveRoutes('driver-1');

    expect(routeQuery.eq).toHaveBeenCalledWith('driver_id', 'driver-1');
    expect(routeQuery.neq).toHaveBeenCalledWith('status', 'completed');
    expect(stopQuery.in).toHaveBeenCalledWith('route_id', ['route-yesterday']);
    expect(stopEq).toHaveBeenCalledWith('status', 'pending');
    expect(routes).toHaveLength(1);
    expect(routes[0].stops[0]).toMatchObject({ id: 'stop-1', orderId: 'order-1' });
  });
});

describe('driverService.completeRouteStop', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('reports success only when the owned pending stop was updated', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    await expect(completeRouteStop('stop-1')).resolves.toEqual({ success: true });
    expect(mockRpc).toHaveBeenCalledWith('complete_own_route_stop', {
      p_stop_id: 'stop-1',
    });
  });

  it('does not treat a denied or already-completed stop as success', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });

    await expect(completeRouteStop('stop-1')).resolves.toEqual({ success: false });
  });

  it('reports database errors as failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(completeRouteStop('stop-1')).resolves.toEqual({ success: false });
  });
});

describe('driverService.transitionOwnDeliveryStop', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('starts an owned delivery stop through the guarded RPC', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    await expect(transitionOwnDeliveryStop('stop-1', 11)).resolves.toEqual({ success: true });
    expect(mockRpc).toHaveBeenCalledWith('transition_own_delivery_stop', {
      p_stop_id: 'stop-1',
      p_target_status: 11,
    });
  });

  it('completes an owned delivery stop through the guarded RPC', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    await expect(transitionOwnDeliveryStop('stop-1', 12)).resolves.toEqual({ success: true });
    expect(mockRpc).toHaveBeenCalledWith('transition_own_delivery_stop', {
      p_stop_id: 'stop-1',
      p_target_status: 12,
    });
  });

  it('rejects duplicate, out-of-order, or unauthorized transitions', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });

    await expect(transitionOwnDeliveryStop('stop-1', 12)).resolves.toEqual({ success: false });
  });
});
