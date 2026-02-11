/**
 * React Query key factory for consistent cache management
 */
export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    user: () => [...queryKeys.auth.all, 'user'] as const,
  },
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.orders.lists(), filters] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.orders.details(), id] as const,
  },
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.users.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.users.all, 'detail', id] as const,
  },
  reports: {
    all: ['reports'] as const,
    sales: (filters: Record<string, unknown>) => [...queryKeys.reports.all, 'sales', filters] as const,
    revenue: (filters: Record<string, unknown>) => [...queryKeys.reports.all, 'revenue', filters] as const,
    zones: (filters: Record<string, unknown>) => [...queryKeys.reports.all, 'zones', filters] as const,
    kpis: () => [...queryKeys.reports.all, 'kpis'] as const,
    drivers: (filters: Record<string, unknown>) => [...queryKeys.reports.all, 'drivers', filters] as const,
    customers: (filters: Record<string, unknown>) => [...queryKeys.reports.all, 'customers', filters] as const,
  },
  audit: {
    all: ['audit'] as const,
    logs: (filters: Record<string, unknown>) => [...queryKeys.audit.all, 'logs', filters] as const,
    systemLogs: (filters: Record<string, unknown>) => [...queryKeys.audit.all, 'system', filters] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.invoices.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.invoices.all, 'detail', id] as const,
  },
  payments: {
    all: ['payments'] as const,
    list: () => [...queryKeys.payments.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.payments.all, 'detail', id] as const,
  },
  loyalty: {
    all: ['loyalty'] as const,
    account: (customerId: string) => [...queryKeys.loyalty.all, 'account', customerId] as const,
    transactions: (customerId: string) => [...queryKeys.loyalty.all, 'transactions', customerId] as const,
    rewards: () => [...queryKeys.loyalty.all, 'rewards'] as const,
    referrals: (customerId: string) => [...queryKeys.loyalty.all, 'referrals', customerId] as const,
  },
  warehouse: {
    all: ['warehouse'] as const,
    intake: () => [...queryKeys.warehouse.all, 'intake'] as const,
    processing: () => [...queryKeys.warehouse.all, 'processing'] as const,
    dispatch: () => [...queryKeys.warehouse.all, 'dispatch'] as const,
    stats: () => [...queryKeys.warehouse.all, 'stats'] as const,
  },
  drivers: {
    all: ['drivers'] as const,
    list: () => [...queryKeys.drivers.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.drivers.all, 'detail', id] as const,
    routes: (driverId: string) => [...queryKeys.drivers.all, 'routes', driverId] as const,
  },
} as const;
