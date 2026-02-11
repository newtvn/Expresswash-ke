import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader, DataTable, StatusBadge, SearchInput } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserPlus, Eye, Pencil, ToggleLeft, Loader2 } from 'lucide-react';
import { getUsers, toggleUserActive } from '@/services/userService';
import type { UserProfile, PaginatedResponse } from '@/types';
import { useToast } from '@/hooks/use-toast';

type TabValue = 'all' | 'customers' | 'drivers' | 'staff';

const roleFilterMap: Record<TabValue, string | undefined> = {
  all: undefined,
  customers: 'customer',
  drivers: 'driver',
  staff: undefined, // staff tab fetches warehouse_staff, admin, super_admin separately
};

const roleLabels: Record<string, string> = {
  customer: 'Customer',
  driver: 'Driver',
  warehouse_staff: 'Staff',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

const STAFF_ROLES = ['warehouse_staff', 'admin', 'super_admin'] as const;

/**
 * Loading skeleton displayed while user data is being fetched.
 */
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 flex gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-24" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex items-center gap-6 px-4 py-3 border-t border-border">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <div className="flex gap-1">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Admin User Management Page
 * Tabs: All Users, Customers, Drivers, Staff.
 * SearchInput for filtering. Actions: View, Edit, Toggle Active.
 * Fetches real data from Supabase via userService.
 */
export const UserManagement = () => {
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Data state per tab
  const [allData, setAllData] = useState<PaginatedResponse<UserProfile> | null>(null);
  const [customerData, setCustomerData] = useState<PaginatedResponse<UserProfile> | null>(null);
  const [driverData, setDriverData] = useState<PaginatedResponse<UserProfile> | null>(null);
  const [staffData, setStaffData] = useState<UserProfile[]>([]);
  const [staffTotal, setStaffTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Debounce search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }, []);

  // Fetch all tab counts and data in parallel
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const baseFilters = {
        search: debouncedSearch || undefined,
        page: 1,
        limit: 100,
      };

      const [allRes, custRes, driverRes, whStaffRes, adminRes, superAdminRes] = await Promise.all([
        getUsers({ ...baseFilters }),
        getUsers({ ...baseFilters, role: 'customer' as UserProfile['role'] }),
        getUsers({ ...baseFilters, role: 'driver' as UserProfile['role'] }),
        getUsers({ ...baseFilters, role: 'warehouse_staff' as UserProfile['role'] }),
        getUsers({ ...baseFilters, role: 'admin' as UserProfile['role'] }),
        getUsers({ ...baseFilters, role: 'super_admin' as UserProfile['role'] }),
      ]);

      setAllData(allRes);
      setCustomerData(custRes);
      setDriverData(driverRes);

      const combinedStaff = [
        ...whStaffRes.data,
        ...adminRes.data,
        ...superAdminRes.data,
      ];
      setStaffData(combinedStaff);
      setStaffTotal(whStaffRes.total + adminRes.total + superAdminRes.total);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load users. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle active/inactive
  const handleToggleActive = useCallback(
    async (userId: string) => {
      setTogglingId(userId);
      try {
        const result = await toggleUserActive(userId);
        if (result.success) {
          toast({
            title: 'User updated',
            description: `User has been ${result.isActive ? 'activated' : 'deactivated'}.`,
          });
          // Refresh data
          await fetchData();
        } else {
          toast({
            title: 'Error',
            description: 'Failed to toggle user status.',
            variant: 'destructive',
          });
        }
      } catch {
        toast({
          title: 'Error',
          description: 'An unexpected error occurred.',
          variant: 'destructive',
        });
      } finally {
        setTogglingId(null);
      }
    },
    [fetchData, toast],
  );

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const userColumns: Column<UserProfile>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'phone', header: 'Phone' },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (row) => (
        <StatusBadge status={row.role} />
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <Badge
          variant="outline"
          className={
            row.isActive
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : 'bg-gray-100 text-gray-600 border-gray-200'
          }
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      sortable: true,
      render: (row) => <span>{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={togglingId === row.id}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleActive(row.id);
            }}
          >
            {togglingId === row.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  const getTabData = (tab: TabValue): UserProfile[] => {
    switch (tab) {
      case 'all':
        return allData?.data ?? [];
      case 'customers':
        return customerData?.data ?? [];
      case 'drivers':
        return driverData?.data ?? [];
      case 'staff':
        return staffData;
      default:
        return [];
    }
  };

  const getTabCount = (tab: TabValue): number => {
    switch (tab) {
      case 'all':
        return allData?.total ?? 0;
      case 'customers':
        return customerData?.total ?? 0;
      case 'drivers':
        return driverData?.total ?? 0;
      case 'staff':
        return staffTotal;
      default:
        return 0;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Manage customers, drivers, and staff">
        <Button onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </PageHeader>

      <SearchInput
        onSearch={handleSearch}
        placeholder="Search by name, email, or phone..."
        className="max-w-sm"
      />

      <Tabs
        defaultValue="all"
        className="space-y-4"
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <TabsList>
          <TabsTrigger value="all">
            All Users {loading ? '' : `(${getTabCount('all')})`}
          </TabsTrigger>
          <TabsTrigger value="customers">
            Customers {loading ? '' : `(${getTabCount('customers')})`}
          </TabsTrigger>
          <TabsTrigger value="drivers">
            Drivers {loading ? '' : `(${getTabCount('drivers')})`}
          </TabsTrigger>
          <TabsTrigger value="staff">
            Staff {loading ? '' : `(${getTabCount('staff')})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {loading ? (
            <TableSkeleton />
          ) : (
            <DataTable
              data={getTabData('all') as (UserProfile & Record<string, unknown>)[]}
              columns={userColumns as Column<UserProfile & Record<string, unknown>>[]}
              searchable={false}
              emptyMessage="No users found"
            />
          )}
        </TabsContent>

        <TabsContent value="customers">
          {loading ? (
            <TableSkeleton />
          ) : (
            <DataTable
              data={getTabData('customers') as (UserProfile & Record<string, unknown>)[]}
              columns={userColumns as Column<UserProfile & Record<string, unknown>>[]}
              searchable={false}
              emptyMessage="No customers found"
            />
          )}
        </TabsContent>

        <TabsContent value="drivers">
          {loading ? (
            <TableSkeleton />
          ) : (
            <DataTable
              data={getTabData('drivers') as (UserProfile & Record<string, unknown>)[]}
              columns={userColumns as Column<UserProfile & Record<string, unknown>>[]}
              searchable={false}
              emptyMessage="No drivers found"
            />
          )}
        </TabsContent>

        <TabsContent value="staff">
          {loading ? (
            <TableSkeleton />
          ) : (
            <DataTable
              data={getTabData('staff') as (UserProfile & Record<string, unknown>)[]}
              columns={userColumns as Column<UserProfile & Record<string, unknown>>[]}
              searchable={false}
              emptyMessage="No staff found"
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Add User Dialog (placeholder) */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm py-8 text-center">
            User creation form coming soon.
          </p>
          <Button onClick={() => setAddDialogOpen(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
