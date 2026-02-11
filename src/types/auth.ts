/**
 * Authentication types and interfaces
 */

export enum UserRole {
  CUSTOMER = 'customer',
  DRIVER = 'driver',
  WAREHOUSE_STAFF = 'warehouse_staff',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  zone?: string;
  avatarUrl?: string;
  isActive?: boolean;
  createdAt: string;
  lastLoginAt?: string;
  loyaltyPoints?: number;
  loyaltyTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalOrders?: number;
  totalSpent?: number;
}

export interface JWTTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SignInFormData {
  email: string;
  password: string;
}

export interface SignUpFormData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  zone: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  tokens?: JWTTokens;
  token?: string; // legacy compat
  error?: string;
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface OTPVerificationFormData {
  otp: string;
  email: string;
}

export interface ResetPasswordFormData {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}
