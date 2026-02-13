import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { CustomerSidebar } from '@/components/customer/CustomerSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { PageErrorBoundary } from '@/components/ErrorBoundary';

const CustomerLayout = () => {
  return (
    <SidebarProvider>
      <CustomerSidebar />
      <SidebarInset>
        <AdminTopBar />
        <div className="flex-1 p-6">
          <ErrorBoundary fullPage={true} showHomeButton={true} fallbackTitle="Customer Page Error">
            <Outlet />
          </ErrorBoundary>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default CustomerLayout;
