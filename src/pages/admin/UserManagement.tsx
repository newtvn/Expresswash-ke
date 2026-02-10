import { useState, useCallback } from 'react';
import { PageHeader, DataTable, StatusBadge, SearchInput } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserPlus, Eye, Pencil, ToggleLeft } from 'lucide-react';

const mockUsers = [
  { id: 'u-101', name: 'Grace Wanjiku', email: 'grace@email.com', phone: '+254711000001', role: 'customer', status: 'active', joined: '2024-03-15' },
  { id: 'u-102', name: 'Peter Kamau', email: 'peter@email.com', phone: '+254711000002', role: 'customer', status: 'active', joined: '2024-04-20' },
  { id: 'u-103', name: 'Mary Njeri', email: 'mary@email.com', phone: '+254711000003', role: 'customer', status: 'active', joined: '2024-05-10' },
  { id: 'u-104', name: 'John Odera', email: 'john@email.com', phone: '+254711000004', role: 'customer', status: 'inactive', joined: '2024-02-01' },
  { id: 'u-105', name: 'Sarah Wambui', email: 'sarah@email.com', phone: '+254711000005', role: 'customer', status: 'active', joined: '2024-06-25' },
  { id: 'u-106', name: 'David Maina', email: 'david@email.com', phone: '+254711000006', role: 'customer', status: 'active', joined: '2024-07-12' },
  { id: 'u-107', name: 'Faith Akinyi', email: 'faith@email.com', phone: '+254711000007', role: 'customer', status: 'suspended', joined: '2024-01-30' },
  { id: 'd-1', name: 'Joseph Mwangi', email: 'joseph@expresswash.co.ke', phone: '+254712345678', role: 'driver', status: 'active', joined: '2024-02-01' },
  { id: 'd-2', name: 'Brian Ochieng', email: 'brian.o@expresswash.co.ke', phone: '+254712345679', role: 'driver', status: 'active', joined: '2024-03-15' },
  { id: 'd-3', name: 'Daniel Kiprop', email: 'daniel@expresswash.co.ke', phone: '+254712345680', role: 'driver', status: 'active', joined: '2024-04-10' },
  { id: 'd-4', name: 'Michael Karanja', email: 'michael@expresswash.co.ke', phone: '+254712345681', role: 'driver', status: 'inactive', joined: '2024-01-20' },
  { id: 's-1', name: 'Jane Njeri', email: 'jane@expresswash.co.ke', phone: '+254700000004', role: 'warehouse_staff', status: 'active', joined: '2024-02-15' },
  { id: 's-2', name: 'Admin User', email: 'admin@expresswash.co.ke', phone: '+254700000001', role: 'admin', status: 'active', joined: '2024-01-01' },
  { id: 's-3', name: 'Super Admin', email: 'super@expresswash.co.ke', phone: '+254700000000', role: 'super_admin', status: 'active', joined: '2024-01-01' },
];

const roleLabels: Record<string, string> = {
  customer: 'Customer',
  driver: 'Driver',
  warehouse_staff: 'Staff',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

/**
 * Admin User Management Page
 * Tabs: All Users, Customers, Drivers, Staff.
 * SearchInput for filtering. Actions: View, Edit, Toggle Active.
 */
export const UserManagement = () => {
  const [search, setSearch] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const getFilteredUsers = (roleFilter?: string) => {
    let filtered = mockUsers;
    if (roleFilter) {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }
    if (search) {
      const lower = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(lower) ||
          u.email.toLowerCase().includes(lower) ||
          u.phone.includes(lower)
      );
    }
    return filtered;
  };

  const userColumns: Column<(typeof mockUsers)[0]>[] = [
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
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          variant="outline"
          className={
            row.status === 'active'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : row.status === 'inactive'
              ? 'bg-gray-100 text-gray-600 border-gray-200'
              : 'bg-red-100 text-red-800 border-red-200'
          }
        >
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
    { key: 'joined', header: 'Joined', sortable: true },
    {
      key: 'id',
      header: 'Actions',
      render: () => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ToggleLeft className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

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

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Users ({getFilteredUsers().length})</TabsTrigger>
          <TabsTrigger value="customers">Customers ({getFilteredUsers('customer').length})</TabsTrigger>
          <TabsTrigger value="drivers">Drivers ({getFilteredUsers('driver').length})</TabsTrigger>
          <TabsTrigger value="staff">Staff ({getFilteredUsers('warehouse_staff').length + getFilteredUsers('admin').length + getFilteredUsers('super_admin').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <DataTable
            data={getFilteredUsers()}
            columns={userColumns}
            searchable={false}
            searchPlaceholder="Search users..."
          />
        </TabsContent>

        <TabsContent value="customers">
          <DataTable
            data={getFilteredUsers('customer')}
            columns={userColumns}
            searchable={false}
          />
        </TabsContent>

        <TabsContent value="drivers">
          <DataTable
            data={getFilteredUsers('driver')}
            columns={userColumns}
            searchable={false}
          />
        </TabsContent>

        <TabsContent value="staff">
          <DataTable
            data={[...getFilteredUsers('warehouse_staff'), ...getFilteredUsers('admin'), ...getFilteredUsers('super_admin')]}
            columns={userColumns}
            searchable={false}
          />
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
