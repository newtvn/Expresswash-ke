import { useEffect, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/authStore';
import { useBusinessStore, BUSINESS_ALL } from '@/stores/businessStore';
import { createBusiness } from '@/services/accounting/businesses';

export function BusinessSwitcher() {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  const { businesses, selectedBusiness, setSelectedBusiness, loadBusinesses, loaded } = useBusinessStore();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loaded) void loadBusinesses();
  }, [loaded, loadBusinesses]);

  // A regular admin only ever sees Expresswash — no switcher.
  if (!isSuperAdmin) {
    return (
      <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
        <Building2 className="w-3.5 h-3.5" /> Expresswash
      </Badge>
    );
  }

  const handleChange = (value: string) => {
    setSelectedBusiness(value);
    // Reports/overview are keyed by business; drop cached accounting data.
    qc.invalidateQueries({ queryKey: ['accounting'] });
    qc.invalidateQueries({ queryKey: ['accounts'] });
  };

  const handleAdd = async () => {
    const s = slug.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(s) || !name.trim()) {
      toast.error('Enter a valid slug (a-z, 0-9, _) and name');
      return;
    }
    setSaving(true);
    const created = await createBusiness({ slug: s, name: name.trim() });
    setSaving(false);
    if (!created) {
      toast.error('Could not add business (slug may already exist)');
      return;
    }
    toast.success(`Added ${created.name}`);
    await loadBusinesses();
    setSelectedBusiness(created.slug);
    setAddOpen(false);
    setSlug('');
    setName('');
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
      <Select value={selectedBusiness} onValueChange={handleChange}>
        <SelectTrigger className="min-w-0 flex-1 sm:w-[220px] sm:flex-none">
          <Building2 className="w-4 h-4 mr-2 shrink-0" />
          <SelectValue placeholder="Select business" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={BUSINESS_ALL}>All businesses (consolidated)</SelectItem>
          {businesses.map((b) => (
            <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="Add business">
            <Plus className="w-4 h-4" />
            <span className="sr-only">Add business</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add business</DialogTitle>
            <DialogDescription>
              Register a business so its finances can be tracked and reported in the hub.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="biz-name">Name</Label>
              <Input id="biz-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Ltd" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-slug">Slug</Label>
              <Input id="biz-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme" />
              <p className="text-xs text-muted-foreground">Lowercase letters, digits, underscore. Used to tag this business's finances.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? 'Adding…' : 'Add business'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
