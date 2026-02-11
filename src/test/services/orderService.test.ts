import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackOrder, getOrders, cancelOrder } from '@/services/orderService';

const mockOrder = {
  id: 'order-uuid-1',
  tracking_code: 'EW-2025-12345',
  customer_id: 'customer-uuid-1',
  customer_name: 'Test Customer',
  status: 5,
  pickup_date: '2025-02-15',
  estimated_delivery: '2025-02-18',
  zone: 'Kitengela',
  driver_name: 'John Driver',
  driver_phone: '+254700000001',
  driver_id: 'driver-uuid-1',
  created_at: '2025-02-14T08:00:00Z',
  updated_at: '2025-02-14T10:00:00Z',
};

const mockItems = [
  { id: 'item-1', order_id: 'order-uuid-1', name: 'Carpet', quantity: 2 },
  { id: 'item-2', order_id: 'order-uuid-1', name: 'Rug', quantity: 1 },
];

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: mockSupabase }));

describe('orderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trackOrder', () => {
    it('returns order data on valid tracking code', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockOrder, error: null }),
          };
        }
        if (table === 'order_items') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
      });

      const result = await trackOrder('EW-2025-12345');

      expect(result.success).toBe(true);
      expect(result.order?.trackingCode).toBe('EW-2025-12345');
      expect(result.order?.customerName).toBe('Test Customer');
      expect(result.order?.items).toHaveLength(2);
    });

    it('returns error on invalid tracking code', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      });

      const result = await trackOrder('INVALID-CODE');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('cancelOrder', () => {
    it('refuses to cancel orders at status >= 6', async () => {
      const deliveredOrder = { ...mockOrder, status: 7 };
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: deliveredOrder, error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
      });

      const result = await cancelOrder('EW-2025-12345');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot cancel');
    });
  });
});
