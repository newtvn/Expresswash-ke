import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { JournalEntry } from '@/types/accounting';

interface LedgerJournalEntriesProps {
  entries: JournalEntry[];
  reversePending: boolean;
  writesDisabled?: boolean;
  formatDate: (value?: string | null) => string;
  onReverseJournalEntry: (entry: JournalEntry) => void;
}

const humanize = (value: string) => value.replace(/_/g, ' ');

export function LedgerJournalEntries({
  entries, reversePending, writesDisabled = false, formatDate, onReverseJournalEntry,
}: LedgerJournalEntriesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Journal Entries</CardTitle>
        <p className="text-xs text-muted-foreground">
          Every posted double-entry, newest first. Reversing posts an offsetting entry.
        </p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            No posted journal entries yet. Create an invoice, bill, expense, payment, or journal
            entry and it will appear here.
          </p>
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{entry.entryNumber}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {humanize(entry.sourceType)} · {formatDate(entry.entryDate)} · {entry.status}
                    </p>
                    {entry.memo && <p className="text-xs mt-1">{entry.memo}</p>}
                  </div>
                  {entry.status === 'posted' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={reversePending || writesDisabled}
                          title={writesDisabled ? 'Select a specific business to reverse entries' : undefined}>
                          Reverse
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reverse {entry.entryNumber}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This posts an offsetting journal entry to cancel it out. The original stays on
                            record marked reversed. This can't be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onReverseJournalEntry(entry)}>Reverse entry</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
