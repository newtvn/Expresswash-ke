import { describe, expect, it } from 'vitest';
import { getAuthRedirectPath, isSafeInternalPath } from '@/lib/authRedirect';

describe('authentication redirect safety', () => {
  it('preserves an internal booking location including its query', () => {
    expect(
      getAuthRedirectPath({
        from: {
          pathname: '/portal/request-pickup',
          search: '?service=carpet&zone=Kitengela',
          hash: '',
        },
      }),
    ).toBe('/portal/request-pickup?service=carpet&zone=Kitengela');
  });

  it('rejects protocol-relative and external redirects', () => {
    expect(isSafeInternalPath('//example.com')).toBe(false);
    expect(isSafeInternalPath('https://example.com')).toBe(false);
    expect(getAuthRedirectPath({ from: { pathname: '//example.com' } })).toBeUndefined();
  });
});

