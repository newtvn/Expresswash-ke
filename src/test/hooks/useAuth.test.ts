import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/auth';

// Mock react-router
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockStore = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  setAuth: vi.fn(),
  clearAuth: vi.fn(),
  updateUser: vi.fn(),
  hasRole: vi.fn(),
  hasAnyRole: vi.fn(),
  isAdmin: vi.fn().mockReturnValue(false),
  isCustomer: vi.fn().mockReturnValue(false),
  isDriver: vi.fn().mockReturnValue(false),
  isWarehouseStaff: vi.fn().mockReturnValue(false),
};

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as ReturnType<typeof vi.fn>).mockReturnValue(mockStore);
  });

  it('returns isAuthenticated false when no user', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('returns user data when authenticated', () => {
    const testUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: UserRole.CUSTOMER,
      isActive: true,
      createdAt: '2024-01-01',
    };

    (useAuthStore as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockStore,
      user: testUser,
      isAuthenticated: true,
      isCustomer: vi.fn().mockReturnValue(true),
    });

    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@example.com');
  });
});
