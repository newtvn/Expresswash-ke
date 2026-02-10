import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { signIn as signInService, signUp as signUpService, signOut as signOutService } from '@/services/authService';
import { SignInFormData, SignUpFormData } from '@/types';
import { getDefaultRouteForRole } from '@/config/permissions';

export const useAuth = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, setAuth, clearAuth, setLoading, isLoading } = useAuthStore();

  const login = useCallback(async (formData: SignInFormData) => {
    setLoading(true);
    try {
      const response = await signInService(formData);
      if (response.success && response.user && response.tokens) {
        setAuth(response.user, response.tokens);
        const defaultRoute = getDefaultRouteForRole(response.user.role);
        navigate(defaultRoute);
        return { success: true };
      }
      return { success: false, error: response.error || 'Login failed' };
    } catch {
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setLoading(false);
    }
  }, [navigate, setAuth, setLoading]);

  const register = useCallback(async (formData: SignUpFormData) => {
    setLoading(true);
    try {
      const response = await signUpService(formData);
      if (response.success && response.user && response.tokens) {
        setAuth(response.user, response.tokens);
        navigate('/portal/dashboard');
        return { success: true };
      }
      return { success: false, error: response.error || 'Registration failed' };
    } catch {
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setLoading(false);
    }
  }, [navigate, setAuth, setLoading]);

  const logout = useCallback(async () => {
    await signOutService();
    clearAuth();
    navigate('/');
  }, [clearAuth, navigate]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
  };
};
