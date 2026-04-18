import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, DataTable, StatusBadge, ExportButton } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Mail, MessageSquare, Smartphone, Bell, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────

interface NotificationRow {
  [key: string]: unknown;
  id: string;
  templateName: string;
  channel: string;
  recipientName: string;
  recipientContact: string;
  subject: string;
  body: string;
  status: string;
  sentAt: string;
  failureReason: string;
  retryCount: number;
}

// ── Channel icons ───────────────────────────────────────────────────

const channelIcons: Record<string, React.ElementType> = {
  sms: Smartphone,
  email: Mail,
  whatsapp: MessageSquare,
  push: Bell,
};

const channelColors: Record<string, string> = {
  sms: 'bg-blue-100 text-blue-700',
  email: 'bg-violet-100 text-violet-700',
  whatsapp: 'bg-green-100 text-green-700',
  push: 'bg-amber-100 text-amber-700',
};

const statusColors: Record<string, string> = {
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

// ── Component ───────────────────────────────────────────────────────

export const NotificationCenter = () => {
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedNotif, setSelectedNotif] = useState<NotificationRow | null>(null);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['admin', 'notification-history', channelFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('notification_history')
        .select('*')
        .order('sent_at', { ascending: false, nullsFirst: false })
        .limit(100);

      if (channelFilter !== 'all') query = query.eq('channel', channelFilter);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map((n): NotificationRow => ({
        id: n.id as string,
        templateName: (n.template_name as string) || 'Unknown',
        channel: (n.channel as string) || 'sms',
        recipientName: (n.recipient_name as string) || 'Unknown',
        recipientContact: (n.recipient_contact as string) || '',
        subject: (n.subject as string) || '',
        body: (n.body as string) || '',
        status: (n.status as string) || 'pending',
        sentAt: (n.sent_at as string) || '',
        failureReason: (n.failure_reason as string) || '',
        retryCount: (n.retry_count as number) || 0,
      }));
    },
  });

  // KPI counts
  const totalCount = notifications.length;
  const deliveredCount = notifications.filter(n => n.status === 'delivered').length;
  const failedCount = notifications.filter(n => n.status === 'failed').length;
  const pendingCount = notifications.filter(n => n.status === 'pending').length;

  const columns: Column<NotificationRow>[] = [
    {
      key: 'channel',
      header: 'Channel',
      render: (row) => {
        const Icon = channelIcons[row.channel] ?? Send;
        return (
          <Badge variant="outline" className={cn('gap-1 capitalize', channelColors[row.channel])}>
            <Icon className="w-3 h-3" />
            {row.channel}
          </Badge>
        );
      },
    },
    { key: 'templateName', header: 'Template', sortable: true },
    { key: 'recipientName', header: 'Recipient', sortable: true },
    {
      key: 'recipientContact',
      header: 'Contact',
      render: (row) => (
        <span className="text-xs text-muted-foreground font-mono">{row.recipientContact}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant="outline" className={cn('capitalize', statusColors[row.status])}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'sentAt',
      header: 'Sent',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.sentAt ? new Date(row.sentAt).toLocaleString('en-KE', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
          }) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Notification Center" description="Communication log for all SMS, email, and push notifications">
        <ExportButton data={notifications} filename="notifications-export" />
      </PageHeader>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Sent', value: totalCount, color: 'text-foreground' },
          { label: 'Delivered', value: deliveredCount, color: 'text-emerald-600' },
          { label: 'Pending', value: pendingCount, color: 'text-amber-600' },
          { label: 'Failed', value: failedCount, color: 'text-red-600' },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-card border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="push">Push</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
        </div>
      ) : (
        <DataTable
          data={notifications}
          columns={columns}
          searchPlaceholder="Search notifications..."
          emptyMessage="No notifications found"
          onRowClick={(row) => setSelectedNotif(row)}
        />
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedNotif} onOpenChange={(open) => { if (!open) setSelectedNotif(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
          </DialogHeader>
          {selectedNotif && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Template</p>
                  <p className="font-medium">{selectedNotif.templateName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Channel</p>
                  <Badge variant="outline" className={cn('capitalize', channelColors[selectedNotif.channel])}>
                    {selectedNotif.channel}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Recipient</p>
                  <p className="font-medium">{selectedNotif.recipientName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selectedNotif.recipientContact}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Status</p>
                  <Badge variant="outline" className={cn('capitalize', statusColors[selectedNotif.status])}>
                    {selectedNotif.status}
                  </Badge>
                  {selectedNotif.retryCount > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">({selectedNotif.retryCount} retries)</span>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Sent At</p>
                  <p className="text-sm">{selectedNotif.sentAt ? new Date(selectedNotif.sentAt).toLocaleString('en-KE') : '—'}</p>
                </div>
                {selectedNotif.subject && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Subject</p>
                    <p className="text-sm">{selectedNotif.subject}</p>
                  </div>
                )}
              </div>

              {selectedNotif.failureReason && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-xs font-medium text-red-800 mb-1">Failure Reason</p>
                  <p className="text-xs text-red-700">{selectedNotif.failureReason}</p>
                </div>
              )}

              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Message Body</p>
                {selectedNotif.channel === 'email' ? (
                  <div
                    className="border rounded-lg p-4 bg-white text-sm max-h-64 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: selectedNotif.body }}
                  />
                ) : (
                  <div className="border rounded-lg p-4 bg-muted/30 text-sm whitespace-pre-wrap">
                    {selectedNotif.body}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotificationCenter;
