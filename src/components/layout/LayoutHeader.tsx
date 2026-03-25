import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { signOut } from '@/services/authService';
import Logo from '@/components/shared/Logo';

interface LayoutHeaderProps {
  subtitle?: string;
  className?: string;
}

/**
 * Shared header component for all layouts
 * Displays Express Carpets & Upholstery branding, user name, and logout button
 */
export function LayoutHeader({ subtitle, className = '' }: LayoutHeaderProps) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    clearAuth();
    navigate('/auth/signin');
  };

  return (
    <div className={`flex h-14 items-center justify-between px-4 md:px-6 ${className}`}>
      <div className="flex items-center gap-2">
        <Logo size="sm" />
        {subtitle && (
          <span className="text-sm text-muted-foreground ml-2 hidden sm:inline">
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {user?.name}
        </span>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
          <LogOut className="h-4 w-4" />
          <span className="sr-only">Logout</span>
        </Button>
      </div>
    </div>
  );
}
