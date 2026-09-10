import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}));

import { completeRouteStop } from '@/services/driverService';

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
