import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { JournalEntry } from '@/types/accounting';
import { AlertTriangle } from 'lucide-react';

interface LedgerJournalEntriesProps {
  entries: JournalEntry[];
  reversePending: boolean;
  writesDisabled?: boolean;
  formatDate: (value?: string | null) => string;
  formatCurrency: (value: number | undefined) => string;
  onReverseJournalEntry: (entry: JournalEntry) => void;
}

const humanize = (value: string) => value.replace(/_/g, ' ');

export function LedgerJournalEntries({
  entries, reversePending, writesDisabled = false, formatDate, formatCurrency, onReverseJournalEntry,
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
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold">{entry.sourceReference || entry.entryNumber}</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(entry.amount)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">
                      {humanize(entry.sourceType)} · {formatDate(entry.entryDate)} · {entry.status}
                    </p>
                    {entry.memo && <p className="text-xs mt-1">{entry.memo}</p>}
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={entry.id}>
                      {entry.entryNumber} · {entry.id}
                    </p>
                  </div>
                  {entry.status === 'posted' && entry.sourceType !== 'reversal' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={reversePending || writesDisabled}
                          title={writesDisabled ? 'Select a specific business to reverse entries' : undefined}>
                          Reverse
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reverse {entry.sourceReference || entry.entryNumber}?</AlertDialogTitle>
                          <AlertDialogDescription asChild>
                            <div className="space-y-4 text-left">
                              <p>This creates a permanent offsetting entry. Verify the transaction details before continuing.</p>
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                                <dt className="text-muted-foreground">Amount</dt><dd className="text-right font-semibold text-foreground tabular-nums">{formatCurrency(entry.amount)}</dd>
                                <dt className="text-muted-foreground">Source</dt><dd className="text-right text-foreground">{entry.sourceReference || humanize(entry.sourceType)}</dd>
                                <dt className="text-muted-foreground">Entry date</dt><dd className="text-right text-foreground">{formatDate(entry.entryDate)}</dd>
                                <dt className="text-muted-foreground">Business</dt><dd className="text-right capitalize text-foreground">{entry.business || 'Unassigned'}</dd>
                              </dl>
                              <div>
                                <p className="mb-2 text-sm font-medium text-foreground">Account breakdown</p>
                                <div className="overflow-hidden rounded-lg border">
                                  {entry.lines.map((line) => (
                                    <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 border-b p-3 text-sm last:border-b-0">
                                      <div>
                                        <p className="font-medium text-foreground">{line.accountCode} · {line.accountName}</p>
                                        {line.description && <p className="text-xs text-muted-foreground">{line.description}</p>}
                                      </div>
                                      <div className="text-right tabular-nums text-foreground">
                                        <p>{line.debit > 0 ? `Debit ${formatCurrency(line.debit)}` : `Credit ${formatCurrency(line.credit)}`}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <p className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                The original remains in the audit trail marked reversed. This action cannot be undone.
                              </p>
                              <p className="break-all font-mono text-[11px] text-muted-foreground">Journal ID: {entry.id}</p>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onReverseJournalEntry(entry)} disabled={reversePending}>
                            {reversePending ? 'Reversing…' : `Reverse ${formatCurrency(entry.amount)}`}
                          </AlertDialogAction>
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
