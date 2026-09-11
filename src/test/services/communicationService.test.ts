import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

import {
  getNotificationHistoryPage,
  getNotificationHistoryStats,
} from '@/services/communicationService';

describe('communicationService notification history', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('filters and fetches the requested notification history page with an exact count', async () => {
    const ilike = vi.fn().mockResolvedValue({
      data: [{
        id: 'notification-1',
        template_id: 'template-1',
        template_name: 'Order ready',
        channel: 'sms',
        recipient_id: 'recipient-1',
        recipient_name: 'Jane Customer',
        recipient_contact: '+254700000001',
        subject: null,
        body: 'Your order is ready.',
        status: 'delivered',
        sent_at: '2026-09-11T10:00:00Z',
        delivered_at: '2026-09-11T10:01:00Z',
        failure_reason: null,
        retry_count: 1,
      }],
      count: 47,
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike,
    };
    mockFrom.mockReturnValue(query);

    const result = await getNotificationHistoryPage({
      page: 2,
      pageSize: 20,
      search: ' Jane ',
      channel: 'sms',
      status: 'delivered',
    });

    expect(mockFrom).toHaveBeenCalledWith('notification_history');
    expect(query.select).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(query.order).toHaveBeenCalledWith('sent_at', { ascending: false, nullsFirst: false });
    expect(query.range).toHaveBeenCalledWith(40, 59);
    expect(query.eq).toHaveBeenNthCalledWith(1, 'channel', 'sms');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'status', 'delivered');
    expect(ilike).toHaveBeenCalledWith('recipient_name', '%Jane%');
    expect(result.total).toBe(47);
    expect(result.rows[0]).toMatchObject({
      id: 'notification-1',
      recipientName: 'Jane Customer',
      retryCount: 1,
    });
  });

  it('loads whole-history KPI counts without fetching row bodies', async () => {
    const counts = [120, 90, 20, 10];
    const statusQueries: Array<{ eq: ReturnType<typeof vi.fn> }> = [];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => {
        const result = { count: counts.shift(), error: null };
        const query = {
          eq: vi.fn().mockResolvedValue(result),
          then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
        };
        statusQueries.push(query);
        return query;
      }),
    }));

    await expect(getNotificationHistoryStats()).resolves.toEqual({
      total: 120,
      delivered: 90,
      pending: 20,
      failed: 10,
    });
    expect(mockFrom).toHaveBeenCalledTimes(4);
    expect(statusQueries[0].eq).not.toHaveBeenCalled();
    expect(statusQueries[1].eq).toHaveBeenCalledWith('status', 'delivered');
    expect(statusQueries[2].eq).toHaveBeenCalledWith('status', 'pending');
    expect(statusQueries[3].eq).toHaveBeenCalledWith('status', 'failed');
  });
});
