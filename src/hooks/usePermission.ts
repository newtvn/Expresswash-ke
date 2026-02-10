import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types';
import { hasPermission } from '@/config/permissions';

export const usePermission = () => {
  const { user } = useAuthStore();

  const can = (permission: string): boolean => {
    if (!user) return false;
    return hasPermission(user.role, permission);
  };

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  return { can, hasRole, hasAnyRole, isAdmin, role: user?.role };
};
