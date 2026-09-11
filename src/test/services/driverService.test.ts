import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

import { completeRouteStop, getDriverActiveRoutes, transitionOwnDeliveryStop } from '@/services/driverService';

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
