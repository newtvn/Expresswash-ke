import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, ConfirmDialog, LocationPickerModal } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { MapPin, Plus, Pencil, Trash2, Home, Building, MoreHorizontal, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  type Address,
} from '@/services/addressService';

const labelIcons: Record<string, React.ElementType> = {
  Home: Home,
  Office: Building,
  Other: MoreHorizontal,
};

const emptyForm = { label: '', addressLine: '', zone: '', isDefault: false, latitude: undefined as number | undefined, longitude: undefined as number | undefined };

export const Addresses = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['addresses', user?.id],
    queryFn: () => getAddresses(user!.id),
    enabled: !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: { customerId: string; label: string; addressLine: string; zone: string; isDefault: boolean }) =>
      createAddress(data),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
        toast.success('Address added');
        setDialogOpen(false);
        setForm(emptyForm);
      } else {
        toast.error('Failed to add address');
      }
    },
    onError: () => {
      toast.error('Failed to add address');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateAddress>[1] }) =>
      updateAddress(id, data),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
        toast.success('Address updated');
        setDialogOpen(false);
        setForm(emptyForm);
        setEditId(null);
      } else {
        toast.error('Failed to update address');
      }
    },
    onError: () => {
      toast.error('Failed to update address');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
        toast.success('Address deleted');
      } else {
        toast.error('Failed to delete address');
      }
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Failed to delete address');
      setDeleteId(null);
    },
  });

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (addr: Address) => {
    setEditId(addr.id);
    setForm({ label: addr.label, addressLine: addr.addressLine, zone: addr.zone, isDefault: addr.isDefault, latitude: addr.latitude, longitude: addr.longitude });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.label || !form.addressLine || !form.zone || !user) return;

    if (editId) {
      updateMutation.mutate({
        id: editId,
        data: { customerId: user.id, label: form.label, addressLine: form.addressLine, zone: form.zone, isDefault: form.isDefault, latitude: form.latitude, longitude: form.longitude },
      });
    } else {
      createMutation.mutate({
        customerId: user.id,
        label: form.label,
        addressLine: form.addressLine,
        zone: form.zone,
        isDefault: form.isDefault,
        latitude: form.latitude,
        longitude: form.longitude,
      });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader title="My Addresses" description="Manage your pickup and delivery addresses">
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Address
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-24" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No addresses yet. Add your first pickup address!</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {addresses.map((addr) => {
          const Icon = labelIcons[addr.label] ?? MapPin;
          return (
            <Card key={addr.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-medium">{addr.label}</CardTitle>
                </div>
                {addr.isDefault && (
                  <Badge variant="default" className="text-xs">Default</Badge>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span>{addr.addressLine}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Zone: </span>
                    <span className="font-medium">{addr.zone}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(addr)}>
                      <Pencil className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteId(addr.id)}
                      disabled={addr.isDefault}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Address' : 'Add New Address'}</DialogTitle>
            <DialogDescription className="sr-only">Enter your address details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="addr-label">Label</Label>
              <Select value={form.label} onValueChange={(v) => setForm({ ...form, label: v })}>
                <SelectTrigger id="addr-label">
                  <SelectValue placeholder="Select label" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Home">Home</SelectItem>
                  <SelectItem value="Office">Office</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="addr-line">Address</Label>
              <div className="relative">
                <Input
                  id="addr-line"
                  value={form.addressLine}
                  onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
                  placeholder="Full address"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setMapPickerOpen(true)}
                  title="Pick on map"
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="addr-zone">Zone</Label>
              <Select value={form.zone} onValueChange={(v) => setForm({ ...form, zone: v })}>
                <SelectTrigger id="addr-zone">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kitengela">Kitengela</SelectItem>
                  <SelectItem value="Athi River">Athi River</SelectItem>
                  <SelectItem value="Nairobi">Nairobi</SelectItem>
                  <SelectItem value="Syokimau">Syokimau</SelectItem>
                  <SelectItem value="Mlolongo">Mlolongo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="addr-default"
                checked={form.isDefault}
                onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
              />
              <Label htmlFor="addr-default">Set as default address</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                editId ? 'Save Changes' : 'Add Address'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Address"
        description="Are you sure you want to delete this address? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />

      {/* Location Picker Modal */}
      <LocationPickerModal
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        onSelect={({ address, lat, lng }) => {
          setForm((prev) => ({ ...prev, addressLine: address, latitude: lat, longitude: lng }));
        }}
        initialCenter={form.latitude && form.longitude ? { lat: form.latitude, lng: form.longitude } : undefined}
        initialAddress={form.addressLine}
      />
    </div>
  );
};

export default Addresses;
