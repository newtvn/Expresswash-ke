import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { signOut as signOutService } from '@/services/authService';
import { toast } from 'sonner';

interface UseSessionTimeoutOptions {
  timeoutMinutes?: number;
  warningMinutes?: number;
  onTimeout?: () => void;
  onWarning?: () => void;
}

/**
 * Get timeout duration based on user role
 * - super_admin, admin: 60 minutes
 * - warehouse_staff, driver: 45 minutes
 * - customer: 30 minutes
 * - default: 30 minutes (from env or fallback)
 */
function getRoleBasedTimeout(role?: string): number {
  const envTimeout = parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES || '30', 10);

  if (!role) return envTimeout;

  const timeoutMap: Record<string, number> = {
    super_admin: 60,
    admin: 60,
    warehouse_staff: 45,
    driver: 45,
    customer: 30,
  };

  return timeoutMap[role] ?? envTimeout;
}

export const useSessionTimeout = (options: UseSessionTimeoutOptions = {}) => {
  const navigate = useNavigate();
  const { clearAuth, isAuthenticated, user } = useAuthStore();

  // Get role-based timeout (can be overridden by options)
  const roleBasedTimeout = getRoleBasedTimeout(user?.role);
  const {
    timeoutMinutes = options.timeoutMinutes ?? roleBasedTimeout,
    warningMinutes = 2, // Warn 2 minutes before timeout
  } = options;
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(timeoutMinutes * 60);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, []);

  const handleLogout = useCallback(async () => {
    clearTimeouts();
    await signOutService();
    clearAuth();
    setShowWarning(false);
    navigate('/auth/signin');
    toast.info('You have been logged out due to inactivity');
    options.onTimeout?.();
  }, [clearTimeouts, clearAuth, navigate, options]);

  const resetTimer = useCallback(() => {
    clearTimeouts();
    setShowWarning(false);
    setRemainingTime(timeoutMinutes * 60);

    if (!isAuthenticated) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1000;

    // Set warning timeout
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      options.onWarning?.();

      // Start countdown
      let secondsLeft = warningMinutes * 60;
      setRemainingTime(secondsLeft);

      countdownIntervalRef.current = setInterval(() => {
        secondsLeft--;
        setRemainingTime(secondsLeft);

        if (secondsLeft <= 0 && countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
      }, 1000);

      toast.warning(
        `You will be logged out in ${warningMinutes} minutes due to inactivity. Click to stay logged in.`,
        {
          duration: warningMinutes * 60 * 1000,
          action: {
            label: 'Stay Logged In',
            onClick: () => resetTimer(), // Wrap in arrow function to avoid stale closure
          },
        }
      );
    }, warningMs);

    // Set logout timeout
    timeoutRef.current = setTimeout(handleLogout, timeoutMs);
  }, [clearTimeouts, timeoutMinutes, warningMinutes, isAuthenticated, handleLogout, options]);

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimeouts();
      return;
    }

    // Events that count as user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    // Stable handler wrapped in useCallback
    const handleActivity = () => {
      resetTimer();
    };

    // Initialize timer
    resetTimer();

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      clearTimeouts();
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated, resetTimer, clearTimeouts]);

  return {
    showWarning,
    remainingTime,
    resetTimer,
    dismissWarning,
    handleLogout,
  };
};
