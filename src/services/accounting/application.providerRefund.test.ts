import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repository from './repository';
import { completeProviderRefund, requestProviderRefund } from './application';

vi.mock('./repository', () => ({
  requestProviderRefund: vi.fn(),
  completeProviderRefund: vi.fn(),
}));

describe('provider refund application boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid requests before invoking the Edge Function repository', async () => {
    const result = await requestProviderRefund({
      paymentId: '',
      amount: 0,
      reason: '',
      idempotencyKey: '',
    });
    expect(result.success).toBe(false);
    expect(repository.requestProviderRefund).not.toHaveBeenCalled();
  });

  it('preserves one idempotency key for a valid provider request', async () => {
    vi.mocked(repository.requestProviderRefund).mockResolvedValue({
      success: true,
      requestId: 'refund-request-id',
      status: 'processing',
    });
    const input = {
      paymentId: 'payment-id',
      amount: 100,
      reason: 'Service not supplied',
      idempotencyKey: 'stable-request-key',
    };
    const result = await requestProviderRefund(input);
    expect(repository.requestProviderRefund).toHaveBeenCalledWith(input);
    expect(result.status).toBe('processing');
  });

  it('requires independent completion evidence before posting', async () => {
    const invalid = await completeProviderRefund({ refundRequestId: 'request-id', evidenceReference: ' ' });
    expect(invalid.success).toBe(false);
    expect(repository.completeProviderRefund).not.toHaveBeenCalled();

    vi.mocked(repository.completeProviderRefund).mockResolvedValue({ success: true, status: 'completed' });
    const valid = await completeProviderRefund({
      refundRequestId: 'request-id',
      evidenceReference: 'SETTLEMENT-REPORT-1',
    });
    expect(valid.status).toBe('completed');
  });
});
