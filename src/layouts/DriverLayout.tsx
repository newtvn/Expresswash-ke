import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Route, Package, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LayoutHeader } from '@/components/layout/LayoutHeader';

const bottomNavItems = [
  { name: 'Dashboard', href: '/driver/dashboard', icon: LayoutDashboard },
  { name: 'Route', href: '/driver/route', icon: Route },
  { name: 'Orders', href: '/driver/orders', icon: Package },
  { name: 'Cash', href: '/driver/cash', icon: Banknote },
];

const DriverLayout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <LayoutHeader />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 pb-20">
        <ErrorBoundary fullPage={true} showHomeButton={true} fallbackTitle="Driver Page Error">
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/driver/dashboard'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 min-w-[4rem] min-h-[3rem] px-3 py-2 text-xs font-medium transition-all duration-200 rounded-lg touch-manipulation [-webkit-tap-highlight-color:transparent] active:scale-95 active:bg-primary/5',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    'relative flex items-center justify-center transition-all duration-200',
                    isActive && 'scale-110'
                  )}>
                    <item.icon className="h-5 w-5 relative z-10" />
                    {isActive && (
                      <div className="absolute inset-0 -m-1.5 rounded-full bg-primary/10 animate-scale-in" />
                    )}
                  </div>
                  <span className={cn(
                    'transition-all duration-200',
                    isActive ? 'font-semibold' : 'font-medium'
                  )}>
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default DriverLayout;
