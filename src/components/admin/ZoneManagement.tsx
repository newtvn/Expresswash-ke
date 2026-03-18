import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllZones, createZone, updateZone, toggleZoneActive,
  type Zone, type ZoneInput,
} from '@/services/zoneService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, MapPin } from 'lucide-react';
import { toast } from 'sonner';

const DELIVERY_DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

export function ZoneManagement() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['admin-zones'],
    queryFn: getAllZones,
  });

  function invalidateZoneQueries() {
    queryClient.invalidateQueries({ queryKey: ['admin-zones'] });
    queryClient.invalidateQueries({ queryKey: ['active-zones'] }); // Customer-facing cache
  }

  const createMutation = useMutation({
    mutationFn: createZone,
    onSuccess: () => {
      invalidateZoneQueries();
      toast.success('Zone created');
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ZoneInput> }) =>
      updateZone(id, input),
    onSuccess: () => {
      invalidateZoneQueries();
      toast.success('Zone updated');
      setDialogOpen(false);
      setEditingZone(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleZoneActive(id, active),
    onSuccess: () => invalidateZoneQueries(),
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const policy = form.get('delivery_policy') as string;

    const input: ZoneInput = {
      name: form.get('name') as string,
      delivery_policy: policy as 'same_day' | '48_hour',
      base_delivery_fee: Number(form.get('base_delivery_fee')),
      cutoff_time: policy === 'same_day' ? (form.get('cutoff_time') as string) || '12:00' : null,
      delivery_days: policy === '48_hour'
        ? DELIVERY_DAYS.filter((d) => form.get(`day_${d}`) === 'on')
        : null,
    };

    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Delivery Zones</h3>
          <p className="text-sm text-muted-foreground">
            Manage delivery areas, fees, and scheduling policies
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingZone(null);
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Zone
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingZone ? 'Edit Zone' : 'Add Delivery Zone'}
              </DialogTitle>
            </DialogHeader>
            <ZoneForm
              zone={editingZone}
              onSubmit={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading zones...</p>
      ) : zones.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No delivery zones configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your first delivery zone to enable order placement
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zone</TableHead>
              <TableHead>Policy</TableHead>
              <TableHead>Delivery Days</TableHead>
              <TableHead>Fee (KES)</TableHead>
              <TableHead>Cutoff</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zones.map((zone) => (
              <TableRow key={zone.id}>
                <TableCell className="font-medium">{zone.name}</TableCell>
                <TableCell>
                  <Badge variant={zone.delivery_policy === 'same_day' ? 'default' : 'secondary'}>
                    {zone.delivery_policy === 'same_day' ? 'Same Day' : '48 Hour'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {zone.delivery_days?.map((d) => d.slice(0, 3).toUpperCase()).join(', ') || '\u2014'}
                </TableCell>
                <TableCell>{zone.base_delivery_fee.toLocaleString()}</TableCell>
                <TableCell>{zone.cutoff_time?.slice(0, 5) || '\u2014'}</TableCell>
                <TableCell>
                  <Switch
                    checked={zone.is_active}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: zone.id, active: checked })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setEditingZone(zone); setDialogOpen(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ZoneForm({
  zone,
  onSubmit,
  loading,
}: {
  zone: Zone | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
}) {
  const [policy, setPolicy] = useState(zone?.delivery_policy || 'same_day');

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Zone Name</Label>
        <Input id="name" name="name" defaultValue={zone?.name || ''} required placeholder="e.g. Kitengela" />
      </div>

      <div className="space-y-2">
        <Label>Delivery Policy</Label>
        <Select name="delivery_policy" defaultValue={policy} onValueChange={setPolicy}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="same_day">Same Day</SelectItem>
            <SelectItem value="48_hour">48 Hour</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="base_delivery_fee">Delivery Fee (KES)</Label>
        <Input
          id="base_delivery_fee" name="base_delivery_fee" type="number"
          defaultValue={zone?.base_delivery_fee || 200} required min={0}
        />
      </div>

      {policy === 'same_day' && (
        <div className="space-y-2">
          <Label htmlFor="cutoff_time">Same-Day Cutoff Time</Label>
          <Input
            id="cutoff_time" name="cutoff_time" type="time"
            defaultValue={zone?.cutoff_time?.slice(0, 5) || '12:00'}
          />
          <p className="text-xs text-muted-foreground">Orders after this time go to next-day</p>
        </div>
      )}

      {policy === '48_hour' && (
        <div className="space-y-2">
          <Label>Delivery Days</Label>
          <div className="flex flex-wrap gap-3">
            {DELIVERY_DAYS.map((day) => (
              <label key={day} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox" name={`day_${day}`}
                  defaultChecked={zone?.delivery_days?.includes(day)}
                  className="rounded"
                />
                {day.charAt(0).toUpperCase() + day.slice(1, 3)}
              </label>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Saving...' : zone ? 'Update Zone' : 'Create Zone'}
      </Button>
    </form>
  );
}
