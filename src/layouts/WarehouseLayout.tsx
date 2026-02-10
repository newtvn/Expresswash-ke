import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Sparkles, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';

const tabItems = [
  { name: 'Intake', href: '/warehouse' },
  { name: 'Processing', href: '/warehouse/processing' },
  { name: 'Quality Control', href: '/warehouse/quality' },
  { name: 'Dispatch', href: '/warehouse/dispatch' },
];

const WarehouseLayout = () => {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/auth/signin');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Express<span className="text-primary">Wash</span>
            </span>
            <span className="text-sm text-muted-foreground ml-2 hidden sm:inline">
              Warehouse
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.name}
            </span>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Logout</span>
            </Button>
          </div>
        </div>

        {/* Horizontal Tabs */}
        <div className="flex items-center gap-0 px-6 border-t">
          {tabItems.map((tab) => (
            <NavLink
              key={tab.name}
              to={tab.href}
              end={tab.href === '/warehouse'}
              className={({ isActive }) =>
                cn(
                  'relative px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              {tab.name}
            </NavLink>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default WarehouseLayout;
