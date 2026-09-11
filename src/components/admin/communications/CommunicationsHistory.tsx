import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Search, XCircle } from 'lucide-react';
import { Paginator } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/config/queryKeys';
import {
  getNotificationHistoryPage,
  type NotificationHistoryEntry,
} from '@/services/communicationService';

const HISTORY_PAGE_SIZE = 20;

const statusColor = (status: NotificationHistoryEntry['status']) => {
  if (status === 'delivered') return 'bg-green-100 text-green-800';
  if (status === 'sent') return 'bg-blue-100 text-blue-800';
  if (status === 'failed') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-600';
};

export const CommunicationsHistory = () => {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const filters = { page, search: debouncedSearch };
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.communications.history(filters),
    queryFn: () => getNotificationHistoryPage({
      page,
      pageSize: HISTORY_PAGE_SIZE,
      search: debouncedSearch,
    }),
    placeholderData: (previous) => previous,
  });

  const history = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search recipient names..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-medium">{entry.recipientName}</span>
                    <Badge variant="outline" className="text-xs">{entry.channel}</Badge>
                    <Badge className={`text-xs ${statusColor(entry.status)}`}>{entry.status}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{entry.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(entry.sentAt).toLocaleString()}
                  </p>
                </div>
                {entry.status === 'delivered' ? (
                  <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
                ) : entry.status === 'failed' ? (
                  <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                ) : null}
              </CardContent>
            </Card>
          ))}
          {history.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">No notifications sent yet</p>
          )}
          <Paginator
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={HISTORY_PAGE_SIZE}
            onPageChange={setPage}
            className="mt-4"
          />
        </div>
      )}
    </div>
  );
};
