import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, DataTable, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Save, X, Edit, Star, ShoppingCart, DollarSign, Award, Copy, ShieldOff, ShieldCheck, CheckCircle, XCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getUserById, updateUser } from '@/services/userService';
import { getOrders } from '@/services/orderService';
import { getInvoices } from '@/services/invoiceService';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';
import { getOrderStatusLabel } from '@/constants/orderStatus';

// ── Types for tab data ───────────────────────────────────────────────

interface LoyaltyAccountRow {
  [key: string]: unknown;
  customer_id: string;
  points: number;
  tier: string;
  lifetime_points: number;
}

interface LoyaltyTransactionRow {
  [key: string]: unknown;
  id: string;
  points: number;
  type: string;
  description: string;
  balance_after: number;
  created_at: string;
}

interface ReviewRow {
  [key: string]: unknown;
  id: string;
  rating: number;
  comment: string;
  status: string;
  created_at: string;
  order_tracking_code: string;
}

interface DriverInfoRow {
  [key: string]: unknown;
  id: string;
  vehicle_plate: string;
  vehicle_type: string;
  license_number: string;
  zone: string;
  status: string;
  is_online: boolean;
  rating: number;
  total_deliveries: number;
}

// ── Order table row type ─────────────────────────────────────────────

interface OrderTableRow {
  [key: string]: unknown;
  id: string;
  trackingCode: string;
  status: number;
  zone: string;
  createdAt: string;
  total: number;
}

// ── Invoice table row type ───────────────────────────────────────────

interface InvoiceTableRow {
  [key: string]: unknown;
  id: string;
  invoiceNumber: string;
  orderNumber: string;
  total: number;
  status: string;
  issuedAt: string;
}

// ── Component ────────────────────────────────────────────────────────

export const UserDetail = () => {
  const { id: userId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [isEditingDriver, setIsEditingDriver] = useState(false);
  const [driverForm, setDriverForm] = useState({ vehiclePlate: '', vehicleType: '', licenseNumber: '' });
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(null);

  // ── Fetch user profile ───────────────────────────────────────────
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => getUserById(userId!),
    enabled: !!userId,
  });

  // ── Fetch user orders ────────────────────────────────────────────
  const { data: ordersResult, isLoading: ordersLoading } = useQuery({
    queryKey: ['admin', 'user-orders', userId],
    queryFn: () => getOrders({ customerId: userId!, page: 1, limit: 50 }),
    enabled: !!userId,
  });

  // ── Fetch user invoices ──────────────────────────────────────────
  const { data: invoicesResult, isLoading: invoicesLoading } = useQuery({
    queryKey: ['admin', 'user-invoices', userId],
    queryFn: () => getInvoices({ customerId: userId!, page: 1, limit: 50 }),
    enabled: !!userId,
  });

  // ── Fetch loyalty account ────────────────────────────────────────
  const { data: loyaltyAccount, isLoading: loyaltyLoading } = useQuery({
    queryKey: ['admin', 'user-loyalty', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('loyalty_accounts')
        .select('*')
        .eq('customer_id', userId!)
        .single();
      return data as LoyaltyAccountRow | null;
    },
    enabled: !!userId,
  });

  // ── Fetch loyalty transactions ───────────────────────────────────
  const { data: loyaltyTransactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['admin', 'user-loyalty-transactions', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('customer_id', userId!)
        .order('created_at', { ascending: false })
        .limit(20);
      return (data ?? []) as LoyaltyTransactionRow[];
    },
    enabled: !!userId,
  });

  // ── Fetch reviews ────────────────────────────────────────────────
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['admin', 'user-reviews', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('reviews')
        .select('*, orders(tracking_code)')
        .eq('customer_id', userId!)
        .order('created_at', { ascending: false });
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        rating: (r.overall_rating as number) ?? 0,
        comment: (r.review_text as string) ?? '',
        status: (r.status as string) ?? 'pending',
        created_at: r.created_at as string,
        order_tracking_code:
          (r.orders as Record<string, unknown> | null)?.tracking_code as string ?? 'N/A',
      })) as ReviewRow[];
    },
    enabled: !!userId,
  });

  // ── Fetch driver info (if driver) ────────────────────────────────
  const { data: driverInfo, isLoading: driverLoading } = useQuery({
    queryKey: ['admin', 'user-driver-info', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', userId!)
        .single();
      return data as DriverInfoRow | null;
    },
    enabled: !!userId && user?.role === 'driver',
  });

  // ── Update mutation ──────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (updates: Partial<UserProfile>) => updateUser(userId!, updates),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Profile updated successfully');
        setIsEditing(false);
        qc.invalidateQueries({ queryKey: ['admin', 'user', userId] });
        qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      } else {
        toast.error('Failed to update profile');
      }
    },
    onError: () => {
      toast.error('An error occurred while updating profile');
    },
  });

  const driverUpdateMutation = useMutation({
    mutationFn: async (updates: { vehiclePlate: string; vehicleType: string; licenseNumber: string }) => {
      const { error } = await supabase.from('drivers').update({
        vehicle_plate: updates.vehiclePlate,
        vehicle_type: updates.vehicleType,
        license_number: updates.licenseNumber,
      }).eq('id', userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Driver details updated');
      setIsEditingDriver(false);
      qc.invalidateQueries({ queryKey: ['admin', 'user-driver-info', userId] });
    },
    onError: () => toast.error('Failed to update driver details'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No user');
      const newStatus = !user.isActive;

      // 1. Update profile
      const { error } = await supabase.from('profiles')
        .update({ is_active: newStatus })
        .eq('id', userId!);
      if (error) throw error;

      // 2. Queue notification email to the user
      await supabase.from('notification_history').insert({
        template_name: newStatus ? 'Account Reactivated' : 'Account Suspended',
        channel: 'email',
        recipient_id: userId,
        recipient_name: user.name,
        recipient_contact: user.email,
        subject: newStatus
          ? `Your ExpressWash account has been reactivated`
          : `Your ExpressWash account has been suspended`,
        body: newStatus
          ? `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#16a34a">Account Reactivated</h2><p>Hi ${user.name},</p><p>Your ExpressWash account has been reactivated. You can now log in and use all services as normal.</p><p style="color:#64748b;font-size:12px;margin-top:24px">ExpressWash Kenya</p></div>`
          : `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">Account Suspended</h2><p>Hi ${user.name},</p><p>Your ExpressWash account has been temporarily suspended. If you believe this is an error, please contact our support team.</p><p style="color:#64748b;font-size:12px;margin-top:24px">ExpressWash Kenya</p></div>`,
        status: 'pending',
      });

      // 3. Audit log
      await supabase.from('audit_logs').insert({
        user_id: qc.getQueryData<{ id: string }>(['auth'])?.id ?? '',
        user_name: 'Admin',
        user_role: 'admin',
        action: 'UPDATE',
        entity: 'user',
        entity_id: userId!,
        details: JSON.stringify({
          action: newStatus ? 'reactivated' : 'suspended',
          userName: user.name,
          userEmail: user.email,
        }),
        ip_address: 'client',
        timestamp: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success(user?.isActive ? 'Account suspended' : 'Account reactivated');
      setStatusDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: () => toast.error('Failed to update account status'),
  });

  const handleStartEditDriver = () => {
    if (!driverInfo) return;
    setDriverForm({
      vehiclePlate: driverInfo.vehicle_plate || '',
      vehicleType: driverInfo.vehicle_type || '',
      licenseNumber: driverInfo.license_number || '',
    });
    setIsEditingDriver(true);
  };

  const handleStartEdit = () => {
    if (!user) return;
    setEditForm({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      zone: user.zone,
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm({});
  };

  // ── Column definitions ───────────────────────────────────────────

  const orderColumns: Column<OrderTableRow>[] = [
    { key: 'trackingCode', header: 'Tracking Code', sortable: true },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={getOrderStatusLabel(row.status)} />,
    },
    { key: 'zone', header: 'Zone', sortable: true },
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="text-sm">{row.createdAt?.split('T')[0]}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (row) => <span className="font-medium">KES {(row.total ?? 0).toLocaleString()}</span>,
    },
  ];

  const invoiceColumns: Column<InvoiceTableRow>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', sortable: true },
    { key: 'orderNumber', header: 'Order #' },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (row) => <span className="font-medium">KES {(row.total ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'issuedAt',
      header: 'Issued',
      sortable: true,
      render: (row) => <span className="text-sm">{row.issuedAt?.split('T')[0]}</span>,
    },
  ];

  const reviewColumns: Column<ReviewRow>[] = [
    { key: 'order_tracking_code', header: 'Order' },
    {
      key: 'rating',
      header: 'Rating',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${i < row.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
            />
          ))}
          <span className="font-medium ml-1 text-sm">{row.rating}/5</span>
        </div>
      ),
    },
    {
      key: 'comment',
      header: 'Comment',
      render: (row) => row.comment ? (
        <p className="text-xs italic text-muted-foreground line-clamp-2 max-w-xs">&ldquo;{row.comment}&rdquo;</p>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="text-sm">{new Date(row.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}</span>,
    },
  ];

  const loyaltyTxColumns: Column<LoyaltyTransactionRow>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (row) => <StatusBadge status={row.type} />,
    },
    { key: 'description', header: 'Description' },
    {
      key: 'points',
      header: 'Points',
      sortable: true,
      render: (row) => (
        <span className={row.points >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
          {row.points >= 0 ? '+' : ''}{row.points}
        </span>
      ),
    },
    {
      key: 'balance_after',
      header: 'Balance',
      render: (row) => <span className="font-medium">{row.balance_after}</span>,
    },
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="text-sm">{row.created_at?.split('T')[0]}</span>,
    },
  ];

  // ── Loading state ────────────────────────────────────────────────

  if (userLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-12 w-full max-w-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Users
        </Button>
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">User not found</p>
        </div>
      </div>
    );
  }

  // ── Order / invoice table data ───────────────────────────────────

  const orderTableData: OrderTableRow[] = (ordersResult?.data ?? []).map((o) => ({
    id: o.id ?? '',
    trackingCode: o.trackingCode,
    status: o.status,
    zone: o.zone,
    createdAt: o.createdAt ?? '',
    total: o.total ?? 0,
  }));

  const invoiceTableData: InvoiceTableRow[] = (invoicesResult?.data ?? []).map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    orderNumber: inv.orderNumber,
    total: inv.total,
    status: inv.status,
    issuedAt: inv.issuedAt,
  }));

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Users
        </Button>
      </div>

      <PageHeader
        title={user.name || 'Unnamed User'}
        description={`${user.email} | ${user.role?.replace('_', ' ')} | ${user.zone || 'No zone'}`}
      >
        <Badge
          variant="outline"
          className={
            user.isActive
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : 'bg-gray-100 text-gray-600 border-gray-200'
          }
        >
          {user.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </PageHeader>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="orders">Orders ({orderTableData.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({invoiceTableData.length})</TabsTrigger>
          <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          {user.role === 'driver' && <TabsTrigger value="driver">Driver Info</TabsTrigger>}
        </TabsList>

        {/* ── Profile Tab ───────────────────────────────────────────── */}
        <TabsContent value="profile">
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Orders</p>
                      <p className="text-xl font-bold">{user.totalOrders ?? ordersResult?.total ?? 0}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Spent</p>
                      <p className="text-xl font-bold">KES {(user.totalSpent ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Loyalty Tier</p>
                      <p className="text-xl font-bold capitalize">{loyaltyAccount?.tier ?? 'Bronze'}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Award className="w-5 h-5 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Loyalty Points</p>
                      <p className="text-xl font-bold">{(loyaltyAccount?.points ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Star className="w-5 h-5 text-violet-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Profile Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-lg">Details</CardTitle>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={handleStartEdit}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                      <Save className="w-4 h-4 mr-2" />
                      {updateMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Full Name</p>
                    {isEditing ? (
                      <Input
                        value={editForm.name ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm font-medium">{user.name || '-'}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Email</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{user.email || '-'}</p>
                      {user.email && (
                        <button
                          className="text-muted-foreground/40 hover:text-primary transition-colors"
                          onClick={() => { navigator.clipboard.writeText(user.email); toast.success('Email copied'); }}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Phone</p>
                    {isEditing ? (
                      <Input
                        value={editForm.phone ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium">{user.phone || '-'}</p>
                        {user.phone && (
                          <button
                            className="text-muted-foreground/40 hover:text-primary transition-colors"
                            onClick={() => { navigator.clipboard.writeText(user.phone!); toast.success('Phone copied'); }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Role</p>
                    {isEditing ? (
                      <Select
                        value={editForm.role ?? user.role}
                        onValueChange={(v) => setEditForm({ ...editForm, role: v as UserProfile['role'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="driver">Driver</SelectItem>
                          <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium capitalize">{user.role?.replace('_', ' ') || '-'}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Zone</p>
                    {isEditing ? (
                      <Select
                        value={editForm.zone ?? user.zone ?? ''}
                        onValueChange={(v) => setEditForm({ ...editForm, zone: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select zone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Kitengela">Kitengela</SelectItem>
                          <SelectItem value="Athi River">Athi River</SelectItem>
                          <SelectItem value="Syokimau">Syokimau</SelectItem>
                          <SelectItem value="Mlolongo">Mlolongo</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium">{user.zone || '-'}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          user.isActive
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-red-100 text-red-700 border-red-200'
                        }
                      >
                        {user.isActive ? 'Active' : 'Suspended'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-7 text-xs gap-1',
                          user.isActive ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                        )}
                        onClick={() => setStatusDialogOpen(true)}
                      >
                        {user.isActive ? <ShieldOff className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                        {user.isActive ? 'Suspend' : 'Reactivate'}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Joined</p>
                    <p className="text-sm font-medium">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Login</p>
                    <p className="text-sm font-medium">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Orders Tab ────────────────────────────────────────────── */}
        <TabsContent value="orders">
          {ordersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              data={orderTableData}
              columns={orderColumns}
              searchPlaceholder="Search orders..."
              emptyMessage="No orders found for this user"
              onRowClick={(row) => navigate(`/admin/orders/${row.trackingCode}`)}
            />
          )}
        </TabsContent>

        {/* ── Invoices Tab ──────────────────────────────────────────── */}
        <TabsContent value="invoices">
          {invoicesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              data={invoiceTableData}
              columns={invoiceColumns}
              searchPlaceholder="Search invoices..."
              emptyMessage="No invoices found for this user"
            />
          )}
        </TabsContent>

        {/* ── Loyalty Tab ───────────────────────────────────────────── */}
        <TabsContent value="loyalty">
          {loyaltyLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Account summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Loyalty Account</CardTitle>
                </CardHeader>
                <CardContent>
                  {loyaltyAccount ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div>
                        <Label className="text-muted-foreground text-sm">Current Points</Label>
                        <p className="text-2xl font-bold mt-1">{loyaltyAccount.points.toLocaleString()}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-sm">Tier</Label>
                        <p className="mt-1">
                          <Badge variant="outline" className="capitalize text-base">
                            {loyaltyAccount.tier}
                          </Badge>
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-sm">Lifetime Points</Label>
                        <p className="text-2xl font-bold mt-1">{loyaltyAccount.lifetime_points.toLocaleString()}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No loyalty account found for this user.</p>
                  )}
                </CardContent>
              </Card>

              {/* Recent transactions */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  {txLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : loyaltyTransactions.length > 0 ? (
                    <DataTable
                      data={loyaltyTransactions}
                      columns={loyaltyTxColumns}
                      searchable={false}
                      pageSize={10}
                      emptyMessage="No transactions found"
                    />
                  ) : (
                    <p className="text-muted-foreground">No loyalty transactions found.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Reviews Tab ───────────────────────────────────────────── */}
        <TabsContent value="reviews">
          {reviewsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              data={reviews}
              columns={reviewColumns}
              searchPlaceholder="Search reviews..."
              emptyMessage="No reviews found for this user"
              onRowClick={(row) => setSelectedReview(row)}
            />
          )}
        </TabsContent>

        {/* ── Driver Info Tab (driver users only) ───────────────────── */}
        {user.role === 'driver' && (
          <TabsContent value="driver">
            {driverLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : driverInfo ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-lg">Driver Details</CardTitle>
                  {!isEditingDriver ? (
                    <Button variant="outline" size="sm" onClick={handleStartEditDriver}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsEditingDriver(false)}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => driverUpdateMutation.mutate(driverForm)} disabled={driverUpdateMutation.isPending}>
                        <Save className="w-4 h-4 mr-2" />
                        {driverUpdateMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-muted-foreground text-sm">Vehicle Plate</Label>
                      {isEditingDriver ? (
                        <Input value={driverForm.vehiclePlate} onChange={(e) => setDriverForm({ ...driverForm, vehiclePlate: e.target.value })} className="mt-1" />
                      ) : (
                        <p className="font-medium mt-1">{driverInfo.vehicle_plate || '-'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">Vehicle Type</Label>
                      {isEditingDriver ? (
                        <Select value={driverForm.vehicleType} onValueChange={(v) => setDriverForm({ ...driverForm, vehicleType: v })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="car">Car</SelectItem>
                            <SelectItem value="van">Van</SelectItem>
                            <SelectItem value="truck">Truck</SelectItem>
                            <SelectItem value="motorcycle">Motorcycle</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-medium mt-1 capitalize">{driverInfo.vehicle_type || '-'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">License Number</Label>
                      {isEditingDriver ? (
                        <Input value={driverForm.licenseNumber} onChange={(e) => setDriverForm({ ...driverForm, licenseNumber: e.target.value })} className="mt-1" />
                      ) : (
                        <p className="font-medium mt-1">{driverInfo.license_number || '-'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">Status</Label>
                      <p className="mt-1">
                        <StatusBadge status={driverInfo.status} />
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">Online</Label>
                      <p className="mt-1">
                        <Badge
                          variant="outline"
                          className={
                            driverInfo.is_online
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }
                        >
                          {driverInfo.is_online ? 'Online' : 'Offline'}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">Rating</Label>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-medium">{driverInfo.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">Total Deliveries</Label>
                      <p className="font-medium mt-1">{driverInfo.total_deliveries}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No driver record found for this user.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Account Status Confirmation Dialog */}
      <ConfirmDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        title={user.isActive ? 'Suspend Account' : 'Reactivate Account'}
        description={
          user.isActive
            ? `Are you sure you want to suspend ${user.name}'s account? They will be unable to log in or place orders. An email notification will be sent to ${user.email}.`
            : `Are you sure you want to reactivate ${user.name}'s account? They will regain full access. An email notification will be sent to ${user.email}.`
        }
        confirmLabel={user.isActive ? 'Yes, Suspend Account' : 'Yes, Reactivate Account'}
        onConfirm={() => toggleStatusMutation.mutate()}
        variant={user.isActive ? 'destructive' : 'default'}
      />

      {/* Review Detail Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={(open) => { if (!open) setSelectedReview(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Order</p>
                <p className="text-sm font-medium">{selectedReview.order_tracking_code}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Rating</p>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${i < selectedReview.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                    />
                  ))}
                  <span className="font-medium ml-2 text-sm">{selectedReview.rating}/5</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Comment</p>
                <div className="bg-muted/40 rounded-lg px-4 py-3 border border-border/50">
                  <p className="text-sm italic leading-relaxed">&ldquo;{selectedReview.comment || 'No comment'}&rdquo;</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Date</p>
                <p className="text-sm font-medium">
                  {new Date(selectedReview.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
              {selectedReview.status === 'pending' && (
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                    onClick={() => {
                      toast.success('Review approved');
                      setSelectedReview(null);
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => {
                      toast.success('Review rejected');
                      setSelectedReview(null);
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserDetail;
