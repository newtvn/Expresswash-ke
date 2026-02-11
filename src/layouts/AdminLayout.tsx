import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { PageErrorBoundary } from '@/components/ErrorBoundary';

const AdminLayout = () => {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <AdminTopBar />
        <div className="flex-1 p-6">
          <PageErrorBoundary fallbackTitle="Admin Page Error">
            <Outlet />
          </PageErrorBoundary>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AdminLayout;
