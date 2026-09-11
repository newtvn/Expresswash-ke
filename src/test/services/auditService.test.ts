import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

import { getSystemLogs } from '@/services/auditService';

describe('auditService.getSystemLogs', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('applies multi-level filters and the requested server page', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{
        id: 'log-1',
        timestamp: '2026-09-11T10:00:00Z',
        level: 'error',
        service: 'payments',
        message: 'Payment failed',
      }],
      count: 245,
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      order,
    };
    mockFrom.mockReturnValue(query);

    const result = await getSystemLogs({
      page: 3,
      limit: 100,
      levels: ['info', 'warn', 'error'],
      service: 'payments',
      search: 'failed',
    });

    expect(mockFrom).toHaveBeenCalledWith('system_logs');
    expect(query.select).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(query.in).toHaveBeenCalledWith('level', ['info', 'warn', 'error']);
    expect(query.eq).toHaveBeenCalledWith('service', 'payments');
    expect(query.or).toHaveBeenCalledWith('message.ilike.%failed%,service.ilike.%failed%');
    expect(query.range).toHaveBeenCalledWith(200, 299);
    expect(order).toHaveBeenCalledWith('timestamp', { ascending: false });
    expect(result).toMatchObject({ total: 245, page: 3, limit: 100, totalPages: 3 });
    expect(result.data[0]).toMatchObject({ id: 'log-1', level: 'error' });
  });

  it('returns an empty page without querying when every level is disabled', async () => {
    await expect(getSystemLogs({ page: 1, limit: 100, levels: [] })).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 100,
      totalPages: 0,
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
