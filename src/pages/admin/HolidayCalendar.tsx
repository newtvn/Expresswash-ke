import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Plus, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getHolidays, addHoliday, deleteHoliday, initializeKenyanHolidays } from '@/services/holidayService';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';

const HolidayCalendar = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: '',
    isRecurring: false,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingHoliday, setDeletingHoliday] = useState<{ id: string; name: string } | null>(null);

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['holidays', selectedYear],
    queryFn: () => getHolidays(selectedYear),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      addHoliday(newHoliday.name, newHoliday.date, newHoliday.isRecurring, user!.id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Holiday added successfully');
        setAddDialogOpen(false);
        setNewHoliday({ name: '', date: '', isRecurring: false });
        qc.invalidateQueries({ queryKey: ['holidays'] });
      } else {
        toast.error(result.message || 'Failed to add holiday');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (holidayId: string) => deleteHoliday(holidayId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Holiday deleted');
        setDeleteDialogOpen(false);
        setDeletingHoliday(null);
        qc.invalidateQueries({ queryKey: ['holidays'] });
      } else {
        toast.error(result.message || 'Failed to delete holiday');
      }
    },
  });

  const initializeMutation = useMutation({
    mutationFn: () => initializeKenyanHolidays(selectedYear, user!.id),
    onSuccess: (result) => {
      toast.success(`Added ${result.added} Kenyan public holidays`);
      qc.invalidateQueries({ queryKey: ['holidays'] });
    },
  });

  const groupedByMonth = holidays.reduce<Record<string, typeof holidays>>((acc, holiday) => {
    const month = new Date(holiday.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[month]) acc[month] = [];
    acc[month].push(holiday);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holiday Calendar"
        description="Manage holidays to exclude from delivery schedules"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => initializeMutation.mutate()}
            disabled={initializeMutation.isPending}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Add Kenyan Holidays
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Holiday
          </Button>
        </div>
      </PageHeader>

      {/* Year Selector */}
      <div className="flex items-center gap-3">
        <Label>Year:</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedYear(selectedYear - 1)}
          >
            ←
          </Button>
          <span className="font-semibold w-20 text-center">{selectedYear}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedYear(selectedYear + 1)}
          >
            →
          </Button>
        </div>
      </div>

      {/* Holidays List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : holidays.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              No holidays configured for {selectedYear}
            </p>
            <Button
              className="mt-4"
              onClick={() => initializeMutation.mutate()}
              disabled={initializeMutation.isPending}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add Kenyan Public Holidays
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByMonth).map(([month, monthHolidays]) => (
            <Card key={month}>
              <CardHeader>
                <CardTitle className="text-lg">{month}</CardTitle>
                <CardDescription>{monthHolidays.length} holidays</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {monthHolidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{holiday.name}</p>
                        {holiday.isRecurring && (
                          <Badge variant="secondary" className="text-xs">
                            Recurring
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(holiday.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setDeletingHoliday({ id: holiday.id, name: holiday.name });
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Holiday Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>
              Add a new holiday to exclude from delivery schedules
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Holiday Name *</Label>
              <Input
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                placeholder="e.g., Christmas Day"
              />
            </div>
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={newHoliday.isRecurring}
                onCheckedChange={(checked) =>
                  setNewHoliday({ ...newHoliday, isRecurring: checked as boolean })
                }
              />
              <label
                htmlFor="recurring"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Recurring annually
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!newHoliday.name || !newHoliday.date || addMutation.isPending}
            >
              {addMutation.isPending ? 'Adding...' : 'Add Holiday'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Holiday</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingHoliday?.name}</strong>?
              This will allow deliveries on this date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingHoliday && deleteMutation.mutate(deletingHoliday.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HolidayCalendar;
