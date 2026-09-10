import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc },
}));

import { dispatchWarehouseOrder } from '@/services/warehouseService';

describe('warehouseService.dispatchWarehouseOrder', () => {
  beforeEach(() => rpc.mockReset());

  it('succeeds only when the database confirms the atomic dispatch', async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(dispatchWarehouseOrder('order-1')).resolves.toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith('dispatch_warehouse_order', { p_order_id: 'order-1' });
  });

  it('rejects a false result', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(dispatchWarehouseOrder('order-1')).resolves.toEqual({
      success: false,
      error: 'Order was not dispatched',
    });
  });

  it('returns the database error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Assign a driver before dispatching' } });

    await expect(dispatchWarehouseOrder('order-1')).resolves.toEqual({
      success: false,
      error: 'Assign a driver before dispatching',
    });
  });
});
