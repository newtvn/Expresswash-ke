interface RedirectLocation {
  pathname?: unknown;
  search?: unknown;
  hash?: unknown;
}

export const isSafeInternalPath = (path: string) =>
  path.startsWith('/') && !path.startsWith('//');

export const getAuthRedirectPath = (state: unknown) => {
  if (!state || typeof state !== 'object') return undefined;

  const from = (state as { from?: RedirectLocation }).from;
  if (!from || typeof from.pathname !== 'string') return undefined;
  if (!isSafeInternalPath(from.pathname)) return undefined;

  const search =
    typeof from.search === 'string' && from.search.startsWith('?')
      ? from.search
      : '';
  const hash =
    typeof from.hash === 'string' && from.hash.startsWith('#')
      ? from.hash
      : '';

  return `${from.pathname}${search}${hash}`;
};

