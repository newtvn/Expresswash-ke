import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Settings, Percent, Users, Plus, Trash2, Shield, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types';

// ---------- Service helpers ----------

async function fetchVatConfig() {
  const { data } = await supabase
    .from('system_config')
    .select('*')
    .in('key', ['vat_rate', 'vat_enabled', 'vat_number', 'company_name', 'company_address', 'company_phone', 'company_email']);
  const config: Record<string, string> = {};
  (data ?? []).forEach((row) => { config[row.key as string] = row.value as string; });
  return config;
}

async function saveVatConfig(updates: Record<string, string>) {
  const rows = Object.entries(updates).map(([key, value]) => ({ key, value }));
  for (const row of rows) {
    const { error } = await supabase
      .from('system_config')
      .upsert({ key: row.key, value: row.value }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
  }
}

async function fetchUsers() {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, role, phone, is_active, created_at, avatar_url')
    .order('created_at', { ascending: false });
  return data ?? [];
}

async function updateUserRole(userId: string, role: string) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw new Error(error.message);
}

async function toggleUserActive(userId: string, active: boolean) {
  const { error } = await supabase.from('profiles').update({ is_active: active }).eq('id', userId);
  if (error) throw new Error(error.message);
}

const ROLE_OPTIONS = [
  { value: UserRole.CUSTOMER, label: 'Customer' },
  { value: UserRole.DRIVER, label: 'Driver' },
  { value: UserRole.WAREHOUSE_STAFF, label: 'Warehouse Staff' },
  { value: UserRole.ADMIN, label: 'Admin' },
  { value: UserRole.SUPER_ADMIN, label: 'Super Admin' },
];

const ROLE_COLORS: Record<string, string> = {
  customer: 'bg-blue-100 text-blue-700',
  driver: 'bg-green-100 text-green-700',
  warehouse_staff: 'bg-purple-100 text-purple-700',
  admin: 'bg-orange-100 text-orange-700',
  super_admin: 'bg-red-100 text-red-700',
};

// ---------- Component ----------

export const AdminSettings = () => {
  const qc = useQueryClient();
  const [editRoleUser, setEditRoleUser] = useState<Record<string, unknown> | null>(null);
  const [newRole, setNewRole] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const { data: vatConfig = {}, isLoading: vatLoading } = useQuery({
    queryKey: ['settings', 'vat'],
    queryFn: fetchVatConfig,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['settings', 'users'],
    queryFn: fetchUsers,
    refetchInterval: 60000,
  });

  const [vatForm, setVatForm] = useState<Record<string, string> | null>(null);

  const effectiveVat = vatForm ?? vatConfig;

  const vatMutation = useMutation({
    mutationFn: saveVatConfig,
    onSuccess: () => {
      toast.success('Settings saved');
      setVatForm(null);
      qc.invalidateQueries({ queryKey: ['settings', 'vat'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => updateUserRole(userId, role),
    onSuccess: () => {
      toast.success('Role updated');
      setEditRoleUser(null);
      qc.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeMutation = useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) => toggleUserActive(userId, active),
    onSuccess: (_, { active }) => {
      toast.success(active ? 'User activated' : 'User deactivated');
      qc.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredUsers = users.filter((u) =>
    !userSearch ||
    (u.name as string)?.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email as string)?.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.phone as string)?.toLowerCase().includes(userSearch.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure VAT, manage users, and system preferences" />

      <Tabs defaultValue="vat">
        <TabsList>
          <TabsTrigger value="vat">VAT & Company</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* VAT & Company */}
        <TabsContent value="vat" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" /> VAT Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vatLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">VAT Enabled</p>
                      <p className="text-xs text-muted-foreground">Apply VAT to all invoices and orders</p>
                    </div>
                    <Switch
                      checked={effectiveVat.vat_enabled !== 'false'}
                      onCheckedChange={(checked) => setVatForm({ ...effectiveVat, vat_enabled: String(checked) })}
                    />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>VAT Rate (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={effectiveVat.vat_rate ?? '16'}
                        onChange={(e) => setVatForm({ ...effectiveVat, vat_rate: e.target.value })}
                        placeholder="16"
                      />
                    </div>
                    <div>
                      <Label>VAT Registration Number</Label>
                      <Input
                        value={effectiveVat.vat_number ?? ''}
                        onChange={(e) => setVatForm({ ...effectiveVat, vat_number: e.target.value })}
                        placeholder="P0512345678X"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" /> Company Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Company Name</Label>
                  <Input
                    value={effectiveVat.company_name ?? ''}
                    onChange={(e) => setVatForm({ ...effectiveVat, company_name: e.target.value })}
                    placeholder="Express Carpets Ltd"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={effectiveVat.company_phone ?? ''}
                    onChange={(e) => setVatForm({ ...effectiveVat, company_phone: e.target.value })}
                    placeholder="+254 7XX XXX XXX"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={effectiveVat.company_email ?? ''}
                    onChange={(e) => setVatForm({ ...effectiveVat, company_email: e.target.value })}
                    placeholder="info@expresscarpets.co.ke"
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input
                    value={effectiveVat.company_address ?? ''}
                    onChange={(e) => setVatForm({ ...effectiveVat, company_address: e.target.value })}
                    placeholder="Kitengela, Kajiado County"
                  />
                </div>
              </div>
              {vatForm && (
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => vatMutation.mutate(vatForm)} disabled={vatMutation.isPending}>
                    {vatMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={() => setVatForm(null)}>Discard</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <Input
              className="w-64"
              placeholder="Search by name, email, or phone..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <p className="text-sm text-muted-foreground self-center">{filteredUsers.length} users</p>
          </div>

          {usersLoading ? (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <Card key={u.id as string}>
                  <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{(u.name as string) || 'No name'}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[u.role as string] ?? 'bg-gray-100 text-gray-700'}`}>
                          {u.role as string}
                        </span>
                        {!(u.is_active as boolean) && (
                          <Badge variant="destructive" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{u.email as string} {u.phone ? `· ${u.phone as string}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={u.is_active as boolean}
                        onCheckedChange={(checked) => activeMutation.mutate({ userId: u.id as string, active: checked })}
                        disabled={activeMutation.isPending}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditRoleUser(u); setNewRole(u.role as string); }}
                      >
                        <Shield className="h-3 w-3 mr-1" /> Role
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Role Dialog */}
      <Dialog open={!!editRoleUser} onOpenChange={(open) => { if (!open) setEditRoleUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role — {(editRoleUser?.name as string) || 'User'}</DialogTitle>
            <DialogDescription>Changing roles affects what portals and features this user can access.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>New Role</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleUser(null)}>Cancel</Button>
            <Button
              disabled={roleMutation.isPending || newRole === (editRoleUser?.role as string)}
              onClick={() => { if (editRoleUser) roleMutation.mutate({ userId: editRoleUser.id as string, role: newRole }); }}
            >
              {roleMutation.isPending ? 'Saving...' : 'Save Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSettings;
