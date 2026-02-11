import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { CustomerSidebar } from '@/components/customer/CustomerSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';

const CustomerLayout = () => {
  return (
    <SidebarProvider>
      <CustomerSidebar />
      <SidebarInset>
        <AdminTopBar />
        <div className="flex-1 p-3 sm:p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default CustomerLayout;
