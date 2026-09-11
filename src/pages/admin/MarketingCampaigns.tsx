import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, KPICard, DataTable } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared';
import { Send, Megaphone, CheckCircle, XCircle, Gift, Bell } from 'lucide-react';
import { getNotificationStats } from '@/services/marketingService';
import { getNotificationHistoryPage } from '@/services/communicationService';
import { queryKeys } from '@/config/queryKeys';

type NotifRow = {
  id: string;
  templateName: string;
  channel: string;
  recipientName: string;
  status: string;
  sentAt: string;
};

const notifColumns: Column<NotifRow>[] = [
  { key: 'templateName', header: 'Template', sortable: true },
  {
    key: 'channel',
    header: 'Channel',
    sortable: true,
    render: (row) => <span className="uppercase text-xs font-medium">{row.channel}</span>,
  },
  { key: 'recipientName', header: 'Recipient', sortable: true },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'sentAt',
    header: 'Sent',
    sortable: true,
    render: (row) => row.sentAt ? new Date(row.sentAt).toLocaleString('en-KE') : '—',
  },
];

type ChannelRow = { channel: string; sent: number; failed: number };
const channelColumns: Column<ChannelRow>[] = [
  { key: 'channel', header: 'Channel', render: (row) => <span className="uppercase font-medium">{row.channel}</span> },
  { key: 'sent', header: 'Sent', sortable: true },
  { key: 'failed', header: 'Failed', sortable: true },
];

type PromoRow = { id: string; name: string; code: string; timesUsed: number };
const promoColumns: Column<PromoRow>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'code', header: 'Code' },
  { key: 'timesUsed', header: 'Times Used', sortable: true },
];

type ReminderRow = { id: string; invoiceId: string; channel: string; sentAt: string };
const reminderColumns: Column<ReminderRow>[] = [
  { key: 'invoiceId', header: 'Invoice ID' },
  { key: 'channel', header: 'Channel', render: (row) => <span className="uppercase text-xs">{row.channel}</span> },
  { key: 'sentAt', header: 'Sent At', render: (row) => row.sentAt ? new Date(row.sentAt).toLocaleString('en-KE') : '—' },
];

export const MarketingCampaigns = () => {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 10;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);
  useEffect(() => setPage(0), [debouncedSearch]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'marketing', 'stats'],
    queryFn: getNotificationStats,
  });
  const { data: notificationPage, isLoading: notificationsLoading } = useQuery({
    queryKey: queryKeys.communications.history({ surface: 'marketing', page, search: debouncedSearch }),
    queryFn: () => getNotificationHistoryPage({ page, pageSize, search: debouncedSearch }),
    placeholderData: (previous) => previous,
  });
  const recentNotifications: NotifRow[] = (notificationPage?.rows ?? []).map((row) => ({
    id: row.id,
    templateName: row.templateName,
    channel: row.channel,
    recipientName: row.recipientName,
    status: row.status,
    sentAt: row.sentAt,
  }));
  const notificationTotal = notificationPage?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Marketing & Notifications" description="Notification analytics, promotions, and payment reminders" />

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Total Sent" value={stats.totalSent} format="number" icon={Send} />
          <KPICard label="Total Failed" value={stats.totalFailed} format="number" icon={XCircle} />
          <KPICard label="Delivery Rate" value={stats.deliveryRate} format="percentage" icon={CheckCircle} />
          <KPICard label="Active Promos" value={stats.activePromos} format="number" icon={Megaphone} />
        </div>
      )}

      {/* Channel Breakdown */}
      {!isLoading && stats && stats.channelBreakdown.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Channel Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={stats.channelBreakdown} columns={channelColumns} searchable={false} />
          </CardContent>
        </Card>
      )}

      {/* Recent Notifications */}
      {!notificationsLoading && (
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Send className="w-5 h-5" />
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={recentNotifications}
              columns={notifColumns}
              searchable
              searchPlaceholder="Search notifications..."
              pageSize={pageSize}
              serverPagination={{
                page,
                pageSize,
                total: notificationTotal,
                totalPages: Math.max(1, Math.ceil(notificationTotal / pageSize)),
                onPageChange: setPage,
                onSearchChange: setSearch,
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Birthday Promos */}
      {!isLoading && stats && stats.birthdayPromos.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Birthday Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={stats.birthdayPromos} columns={promoColumns} searchable={false} />
          </CardContent>
        </Card>
      )}

      {/* Payment Reminders */}
      {!isLoading && stats && stats.paymentReminders.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Payment Reminders Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={stats.paymentReminders} columns={reminderColumns} searchable={false} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MarketingCampaigns;
