import { useState } from 'react';
import { PageHeader, DataTable, KPICard, StatusBadge, ConfirmDialog } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Wallet, Banknote, ArrowUpRight, CheckCircle } from 'lucide-react';

const mockCashEntries = [
  { id: '1', orderNumber: 'EW-2025-00380', customer: 'Grace Wanjiku', amount: 3500, method: 'cash', time: '09:45 AM', status: 'collected' },
  { id: '2', orderNumber: 'EW-2025-00365', customer: 'Peter Kamau', amount: 2400, method: 'cash', time: '10:30 AM', status: 'collected' },
  { id: '3', orderNumber: 'EW-2025-00350', customer: 'Mary Njeri', amount: 4500, method: 'mpesa', time: '11:15 AM', status: 'completed' },
  { id: '4', orderNumber: 'EW-2025-00398', customer: 'John Odera', amount: 1800, method: 'cash', time: '12:00 PM', status: 'collected' },
  { id: '5', orderNumber: 'EW-2025-00401', customer: 'Sarah Wambui', amount: 2200, method: 'mpesa', time: '01:30 PM', status: 'completed' },
  { id: '6', orderNumber: 'EW-2025-00405', customer: 'David Maina', amount: 3100, method: 'cash', time: '02:45 PM', status: 'collected' },
  { id: '7', orderNumber: 'EW-2025-00410', customer: 'Faith Akinyi', amount: 1500, method: 'cash', time: '03:30 PM', status: 'remitted' },
  { id: '8', orderNumber: 'EW-2025-00412', customer: 'James Mwangi', amount: 2800, method: 'cash', time: '04:15 PM', status: 'collected' },
];

const methodLabels: Record<string, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
};

const columns: Column<(typeof mockCashEntries)[0]>[] = [
  { key: 'orderNumber', header: 'Order #', sortable: true },
  { key: 'customer', header: 'Customer', sortable: true },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    render: (row) => <span className="font-medium">KES {row.amount.toLocaleString()}</span>,
  },
  {
    key: 'method',
    header: 'Payment Method',
    render: (row) => (
      <Badge variant="outline" className="font-medium">
        {methodLabels[row.method] ?? row.method}
      </Badge>
    ),
  },
  { key: 'time', header: 'Time', sortable: true },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export const CashCollection = () => {
  const [remitOpen, setRemitOpen] = useState(false);
  const [confirmRemit, setConfirmRemit] = useState(false);
  const [remitAmount, setRemitAmount] = useState('');

  const cashEntries = mockCashEntries.filter((e) => e.method === 'cash');
  const totalCollected = cashEntries.reduce((sum, e) => sum + e.amount, 0);
  const remitted = cashEntries.filter((e) => e.status === 'remitted').reduce((sum, e) => sum + e.amount, 0);
  const toRemit = totalCollected - remitted;

  const handleRemitSubmit = () => {
    setRemitOpen(false);
    setConfirmRemit(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Cash Collection" description="Track today's cash collections and remittances">
        <Button onClick={() => { setRemitAmount(String(toRemit)); setRemitOpen(true); }} disabled={toRemit <= 0}>
          <ArrowUpRight className="mr-2 h-4 w-4" />
          Remit Cash
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          label="Total Collected"
          value={totalCollected}
          change={0}
          changeDirection="flat"
          format="currency"
          icon={Wallet}
        />
        <KPICard
          label="To Remit"
          value={toRemit}
          change={0}
          changeDirection="flat"
          format="currency"
          icon={Banknote}
        />
        <KPICard
          label="Remitted"
          value={remitted}
          change={0}
          changeDirection="flat"
          format="currency"
          icon={CheckCircle}
        />
      </div>

      {/* Cash Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Today's Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={mockCashEntries}
            columns={columns}
            searchable
            searchPlaceholder="Search collections..."
            pageSize={10}
          />
        </CardContent>
      </Card>

      {/* Remit Dialog */}
      <Dialog open={remitOpen} onOpenChange={setRemitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remit Cash</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount to Remit (KES)</Label>
              <Input
                type="number"
                value={remitAmount}
                onChange={(e) => setRemitAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Outstanding balance: KES {toRemit.toLocaleString()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemitOpen(false)}>Cancel</Button>
            <Button onClick={handleRemitSubmit}>Confirm Remittance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmRemit}
        onOpenChange={setConfirmRemit}
        title="Confirm Remittance"
        description={`Please confirm you are remitting KES ${Number(remitAmount).toLocaleString()} to the office.`}
        confirmLabel="Yes, Remit"
        onConfirm={() => setConfirmRemit(false)}
      />
    </div>
  );
};

export default CashCollection;
