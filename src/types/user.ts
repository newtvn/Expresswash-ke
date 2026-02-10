import { UserRole } from './auth';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  zone: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  loyaltyPoints?: number;
  loyaltyTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalOrders?: number;
  totalSpent?: number;
}

export interface Address {
  id: string;
  customerId: string;
  label: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  zone: string;
  deliveryInstructions?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface UserListFilters {
  role?: UserRole;
  zone?: string;
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
