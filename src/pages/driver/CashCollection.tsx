import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Wallet, Banknote, ArrowUpRight, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/config/queryKeys';
import { getPayments, recordPayment } from '@/services/invoiceService';
import { getOrders } from '@/services/orderService';
import type { Payment } from '@/types';

interface CashEntry {
  id: string;
  orderNumber: string;
  customer: string;
  amount: number;
  method: string;
  time: string;
  status: string;
  invoiceId: string;
  invoiceNumber: string;
}

const methodLabels: Record<string, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};

const columns: Column<CashEntry>[] = [
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [remitOpen, setRemitOpen] = useState(false);
  const [confirmRemit, setConfirmRemit] = useState(false);
  const [remitAmount, setRemitAmount] = useState('');
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectOrderId, setCollectOrderId] = useState('');
  const [collectAmount, setCollectAmount] = useState('');
  const [collectInvoiceId, setCollectInvoiceId] = useState('');
  const [collectInvoiceNumber, setCollectInvoiceNumber] = useState('');

  // Fetch today's payments recorded by this driver
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: [...queryKeys.payments.list(), 'driver', user?.id],
    queryFn: async () => {
      const allPayments = await getPayments();
      // Filter to payments recorded by this driver
      return allPayments.filter((p) => p.recordedBy === user?.id);
    },
    enabled: !!user?.id,
  });

  // Fetch orders assigned to this driver that are in delivery status
  const { data: driverOrders } = useQuery({
    queryKey: [...queryKeys.orders.lists(), 'driver-delivery', user?.id],
    queryFn: () => getOrders({ page: 1, limit: 100 }),
    enabled: !!user?.id,
    select: (result) =>
      result.data.filter(
        (o) => o.driverId === user?.id && o.status >= 10 && o.status <= 12
      ),
  });

  // Map payments to CashEntry format
  const cashEntries: CashEntry[] = payments.map((p) => ({
    id: p.id,
    orderNumber: p.invoiceNumber || p.orderId || '--',
    customer: p.invoiceNumber || p.customerName || '--',
    amount: p.amount,
    method: p.method,
    time: new Date(p.createdAt).toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    status: p.status === 'completed' ? 'collected' : p.status,
    invoiceId: p.invoiceId || '',
    invoiceNumber: p.invoiceNumber || '',
  }));

  const cashOnlyEntries = cashEntries.filter((e) => e.method === 'cash');
  const totalCollected = cashOnlyEntries.reduce((sum, e) => sum + e.amount, 0);
  const remitted = cashOnlyEntries
    .filter((e) => e.status === 'remitted')
    .reduce((sum, e) => sum + e.amount, 0);
  const toRemit = totalCollected - remitted;

  // Record cash payment mutation
  const collectMutation = useMutation({
    mutationFn: () =>
      recordPayment({
        invoiceId: collectInvoiceId,
        invoiceNumber: collectInvoiceNumber,
        amount: parseFloat(collectAmount),
        method: 'cash',
        reference: `CASH-${Date.now()}`,
        status: 'completed',
        recordedBy: user?.id ?? '',
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Cash payment recorded');
        queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
        setCollectOpen(false);
        setCollectAmount('');
      } else {
        toast.error('Failed to record payment');
      }
    },
    onError: () => toast.error('Failed to record payment'),
  });

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
            data={cashEntries}
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
