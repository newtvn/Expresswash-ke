import { Outlet, NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LayoutHeader } from '@/components/layout/LayoutHeader';

const tabItems = [
  { name: 'Intake', href: '/warehouse' },
  { name: 'Processing', href: '/warehouse/processing' },
  { name: 'Quality Control', href: '/warehouse/quality' },
  { name: 'Dispatch', href: '/warehouse/dispatch' },
];

const WarehouseLayout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <LayoutHeader subtitle="Warehouse" />

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
        <ErrorBoundary fullPage={true} showHomeButton={true} fallbackTitle="Warehouse Page Error">
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default WarehouseLayout;
