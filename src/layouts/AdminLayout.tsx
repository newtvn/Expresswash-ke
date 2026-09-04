import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const AdminLayout = () => {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <AdminTopBar />
        <div className="admin-content min-w-0 flex-1 px-4 py-4 sm:px-5 md:px-6 md:py-6">
          <ErrorBoundary fullPage={true} showHomeButton={true} fallbackTitle="Admin Page Error">
            <Outlet />
          </ErrorBoundary>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AdminLayout;
