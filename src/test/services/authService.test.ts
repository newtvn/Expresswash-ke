import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signIn, signOut, forgotPassword } from '@/services/authService';

const mockSupabase = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    verifyOtp: vi.fn(),
    updateUser: vi.fn(),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: mockSupabase }));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signIn', () => {
    it('returns success with user and tokens on valid credentials', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockSession = { access_token: 'access-token', refresh_token: 'refresh-token' };
      const mockProfile = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        phone: '+254700000001',
        role: 'customer',
        zone: 'Kitengela',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        last_login_at: null,
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      });

      const result = await signIn({ email: 'test@example.com', password: 'password123' });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
      expect(result.tokens?.accessToken).toBe('access-token');
    });

    it('returns error on failed login', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await signIn({ email: 'bad@example.com', password: 'wrong' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid login credentials');
    });
  });

  describe('signOut', () => {
    it('calls supabase signOut', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });
      await signOut();
      expect(mockSupabase.auth.signOut).toHaveBeenCalledOnce();
    });
  });

  describe('forgotPassword', () => {
    it('returns success message on valid email', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
      const result = await forgotPassword('test@example.com');
      expect(result.success).toBe(true);
      expect(result.message).toContain('sent');
    });

    it('returns error message on failure', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        error: { message: 'User not found' },
      });
      const result = await forgotPassword('unknown@example.com');
      expect(result.success).toBe(false);
    });
  });
});
