import { useState } from 'react';
import { PageHeader, ConfirmDialog } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { MapPin, Plus, Pencil, Trash2, Home, Building, MoreHorizontal } from 'lucide-react';

interface AddressItem {
  id: string;
  label: string;
  addressLine: string;
  zone: string;
  isDefault: boolean;
}

const labelIcons: Record<string, React.ElementType> = {
  Home: Home,
  Office: Building,
  Other: MoreHorizontal,
};

const initialAddresses: AddressItem[] = [
  { id: '1', label: 'Home', addressLine: '45 Namanga Road, Kitengela', zone: 'Kitengela', isDefault: true },
  { id: '2', label: 'Office', addressLine: '12 Moi Avenue, Nairobi CBD', zone: 'Nairobi', isDefault: false },
  { id: '3', label: 'Other', addressLine: '8 River View Estate, Athi River', zone: 'Athi River', isDefault: false },
];

const emptyForm = { label: '', addressLine: '', zone: '', isDefault: false };

export const Addresses = () => {
  const [addresses, setAddresses] = useState<AddressItem[]>(initialAddresses);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (addr: AddressItem) => {
    setEditId(addr.id);
    setForm({ label: addr.label, addressLine: addr.addressLine, zone: addr.zone, isDefault: addr.isDefault });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.label || !form.addressLine || !form.zone) return;

    setAddresses((prev) => {
      let updated = [...prev];

      if (form.isDefault) {
        updated = updated.map((a) => ({ ...a, isDefault: false }));
      }

      if (editId) {
        return updated.map((a) =>
          a.id === editId ? { ...a, ...form } : a
        );
      }
      return [...updated, { id: String(Date.now()), ...form }];
    });

    setDialogOpen(false);
    setForm(emptyForm);
    setEditId(null);
  };

  const handleDelete = () => {
    if (deleteId) {
      setAddresses((prev) => prev.filter((a) => a.id !== deleteId));
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Addresses" description="Manage your pickup and delivery addresses">
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Address
        </Button>
      </PageHeader>

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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Address' : 'Add New Address'}</DialogTitle>
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
              <Input
                id="addr-line"
                value={form.addressLine}
                onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
                placeholder="Full address"
              />
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
            <Button onClick={handleSave}>{editId ? 'Save Changes' : 'Add Address'}</Button>
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
    </div>
  );
};

export default Addresses;
