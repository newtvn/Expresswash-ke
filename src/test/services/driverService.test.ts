import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}));

import { completeRouteStop, transitionOwnDeliveryStop } from '@/services/driverService';

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
