import { describe, expect, it } from 'vitest';
import { retrySupabaseQuery } from '@/lib/retryUtils';

describe('retrySupabaseQuery', () => {
  it('preserves Supabase response metadata used by server pagination', async () => {
    const response = await retrySupabaseQuery(async () => ({
      data: [{ id: 'row-1' }],
      count: 42,
      status: 206,
      statusText: 'Partial Content',
      error: null,
    }));

    expect(response.data).toEqual([{ id: 'row-1' }]);
    expect(response.count).toBe(42);
    expect(response.status).toBe(206);
  });
});
