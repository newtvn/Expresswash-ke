/**
 * Application routes configuration - all portal routes
 */
export const ROUTES = {
  // Public
  HOME: '/',
  SERVICES: '/services',
  PRICING: '/pricing',
  TRACK_ORDER: '/track',
  FAQ: '/faq',
  CONTACT: '/contact',

  // Auth
  SIGN_IN: '/auth/signin',
  SIGN_UP: '/auth/signup',
  FORGOT_PASSWORD: '/auth/forgot-password',
  OTP_VERIFICATION: '/auth/verify-otp',
  RESET_PASSWORD: '/auth/reset-password',

  // Customer Portal
  CUSTOMER_DASHBOARD: '/portal/dashboard',
  CUSTOMER_REQUEST_PICKUP: '/portal/request-pickup',
  CUSTOMER_ORDERS: '/portal/orders',
  CUSTOMER_ORDER_DETAILS: '/portal/orders/:id',
  CUSTOMER_FAVORITES: '/portal/favorites',
  CUSTOMER_ADDRESSES: '/portal/addresses',
  CUSTOMER_INVOICES: '/portal/invoices',
  CUSTOMER_PAYMENTS: '/portal/payments',
  CUSTOMER_LOYALTY: '/portal/loyalty',
  CUSTOMER_REFERRALS: '/portal/referrals',
  CUSTOMER_REVIEWS: '/portal/reviews',
  CUSTOMER_PROFILE: '/portal/profile',
  CUSTOMER_NOTIFICATIONS: '/portal/notifications',

  // Admin Portal
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_QUOTES: '/admin/quotes',
  ADMIN_USERS: '/admin/users',
  ADMIN_USER_DETAIL: '/admin/users/:id',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_ORDER_DETAILS: '/admin/orders/:id',
  ADMIN_DRIVERS: '/admin/drivers',
  ADMIN_BILLING: '/admin/billing',
  ADMIN_PROFIT_EXPENSE: '/admin/profit-expense',
  ADMIN_MARKETING: '/admin/marketing',
  ADMIN_LOYALTY: '/admin/loyalty',
  ADMIN_REVIEWS: '/admin/reviews',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_INVENTORY: '/admin/inventory',
  ADMIN_COMMUNICATIONS: '/admin/communications',
  ADMIN_SYSTEM_CONFIG: '/admin/system-config',
  ADMIN_AUDIT_LOGS: '/admin/audit-logs',
  ADMIN_SYSTEM_LOGS: '/admin/system-logs',
  ADMIN_NOTIFICATIONS: '/admin/notifications',

  // Driver Portal
  DRIVER_DASHBOARD: '/driver/dashboard',
  DRIVER_ROUTE: '/driver/route',
  DRIVER_PICKUP_DELIVERY: '/driver/pickup-delivery',
  DRIVER_CASH: '/driver/cash',

  // Warehouse Portal
  WAREHOUSE_INTAKE: '/warehouse/intake',
  WAREHOUSE_PROCESSING: '/warehouse/processing',
  WAREHOUSE_QC: '/warehouse/quality-control',
  WAREHOUSE_DISPATCH: '/warehouse/dispatch',

  NOT_FOUND: '*',
} as const;

export type RouteKey = keyof typeof ROUTES;
