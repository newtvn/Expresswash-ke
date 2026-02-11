import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, DataTable, StatusBadge, SearchInput } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { UserPlus, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { getUsers, updateUser, toggleUserActive } from '@/services/userService';
import { UserProfile } from '@/types';
import { UserRole } from '@/types/auth';
import { supabase } from '@/lib/supabase';

export const UserManagement = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', role: 'customer', zone: '', password: '' });
  const [creating, setCreating] = useState(false);

  const { data: allResult, isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => getUsers({ page: 1, limit: 200, search: search || undefined }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleUserActive(id),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`User ${data.isActive ? 'activated' : 'deactivated'}`);
        qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      }
    },
  });

  const all = allResult?.data ?? [];
  const getByRole = (role?: string) =>
    role ? all.filter((u) => u.role === role) : all;

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast.error('Name, email and password are required');
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.auth.admin.createUser({
        email: newUser.email,
        password: newUser.password,
        user_metadata: {
          name: newUser.name,
          phone: newUser.phone,
          role: newUser.role,
          zone: newUser.zone,
        },
        email_confirm: true,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`User ${newUser.name} created successfully`);
        setAddDialogOpen(false);
        setNewUser({ name: '', email: '', phone: '', role: 'customer', zone: '', password: '' });
        qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      }
    } finally {
      setCreating(false);
    }
  };

  const columns: Column<UserProfile>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'phone', header: 'Phone' },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <StatusBadge status={row.role} />,
    },
    { key: 'zone', header: 'Zone' },
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
      render: (row) => <span className="text-sm">{row.createdAt?.split('T')[0]}</span>,
    },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => toggleMutation.mutate(row.id)}
          title={row.isActive ? 'Deactivate' : 'Activate'}
        >
          {row.isActive ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4" />}
        </Button>
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
        onSearch={useCallback((v: string) => setSearch(v), [])}
        placeholder="Search by name, email, or phone..."
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            <TabsTrigger value="customers">Customers ({getByRole('customer').length})</TabsTrigger>
            <TabsTrigger value="drivers">Drivers ({getByRole('driver').length})</TabsTrigger>
            <TabsTrigger value="staff">Staff ({getByRole('warehouse_staff').length + getByRole('admin').length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all"><DataTable data={all} columns={columns} searchable={false} /></TabsContent>
          <TabsContent value="customers"><DataTable data={getByRole('customer')} columns={columns} searchable={false} /></TabsContent>
          <TabsContent value="drivers"><DataTable data={getByRole('driver')} columns={columns} searchable={false} /></TabsContent>
          <TabsContent value="staff">
            <DataTable
              data={[...getByRole('warehouse_staff'), ...getByRole('admin'), ...getByRole('super_admin')]}
              columns={columns}
              searchable={false}
            />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Full Name *</Label><Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="John Doe" /></div>
            <div><Label>Email *</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="john@example.com" /></div>
            <div><Label>Password *</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Minimum 6 characters" /></div>
            <div><Label>Phone</Label><Input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} placeholder="+254 7XX XXX XXX" /></div>
            <div>
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Zone</Label>
              <Select value={newUser.zone} onValueChange={(v) => setNewUser({ ...newUser, zone: v })}>
                <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kitengela">Kitengela</SelectItem>
                  <SelectItem value="Athi River">Athi River</SelectItem>
                  <SelectItem value="Syokimau">Syokimau</SelectItem>
                  <SelectItem value="Mlolongo">Mlolongo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={creating}>{creating ? 'Creating...' : 'Create User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
