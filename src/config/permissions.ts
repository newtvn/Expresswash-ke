import { UserRole } from '@/types';

/**
 * Role-based permission mappings for portal access
 */
export const PORTAL_ACCESS: Record<string, UserRole[]> = {
  admin: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  customer: [UserRole.CUSTOMER],
  driver: [UserRole.DRIVER],
  warehouse: [UserRole.WAREHOUSE_STAFF],
};

/**
 * Granular permissions for admin features
 */
export const ADMIN_PERMISSIONS: Record<string, UserRole[]> = {
  'admin.dashboard': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.users': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.orders': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.drivers': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.billing': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.profit-expense': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.marketing': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.loyalty': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.reviews': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.reports': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.inventory': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.communications': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.system-config': [UserRole.SUPER_ADMIN],
  'admin.audit-logs': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin.system-logs': [UserRole.SUPER_ADMIN],
};

/**
 * Get the default landing route for a given user role
 */
export const getDefaultRouteForRole = (role: UserRole): string => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
    case UserRole.ADMIN:
      return '/admin/dashboard';
    case UserRole.CUSTOMER:
      return '/portal/dashboard';
    case UserRole.DRIVER:
      return '/driver/dashboard';
    case UserRole.WAREHOUSE_STAFF:
      return '/warehouse/intake';
    default:
      return '/';
  }
};

/**
 * Check if a role can access a specific permission
 */
export const hasPermission = (role: UserRole, permission: string): boolean => {
  const allowedRoles = ADMIN_PERMISSIONS[permission] || PORTAL_ACCESS[permission];
  return allowedRoles ? allowedRoles.includes(role) : false;
};
