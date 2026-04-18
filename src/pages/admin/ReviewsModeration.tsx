import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, DataTable, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Star, ThumbsUp, ThumbsDown, MessageSquare, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { queryKeys } from '@/config/queryKeys';
import {
  getAllReviews,
  moderateReview,
  getReviewStats,
  type Review,
  type ReviewStats,
} from '@/services/reviewService';

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`w-4 h-4 ${
          star <= rating
            ? 'text-yellow-500 fill-yellow-500'
            : 'text-gray-200'
        }`}
      />
    ))}
  </div>
);

/**
 * Admin Reviews & Moderation Page
 * Reviews table with ratings, approve/reject actions, and summary stats.
 */
export const ReviewsModeration = () => {
  const queryClient = useQueryClient();
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: queryKeys.reviews.pending(),
    queryFn: () => getAllReviews(),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.reviews.stats(),
    queryFn: getReviewStats,
  });

  const moderateMutation = useMutation({
    mutationFn: ({ reviewId, action }: { reviewId: string; action: 'approved' | 'rejected' }) =>
      moderateReview(reviewId, action),
    onSuccess: (result, { action }) => {
      if (result.success) {
        toast.success(`Review ${action}`);
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
      } else {
        toast.error(result.error ?? 'Failed to moderate review');
      }
    },
    onError: () => {
      toast.error('Failed to moderate review');
    },
  });

  const reviewStats = [
    {
      label: 'Average Rating',
      value: stats?.averageRating?.toFixed(1) ?? '0',
      icon: Star,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      label: 'Total Reviews',
      value: String(stats?.totalReviews ?? 0),
      icon: MessageSquare,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Pending Approval',
      value: String(stats?.pendingCount ?? 0),
      icon: TrendingUp,
      color: 'bg-orange-100 text-orange-600',
    },
    {
      label: 'This Month',
      value: String(stats?.thisMonthCount ?? 0),
      icon: ThumbsUp,
      color: 'bg-emerald-100 text-emerald-600',
    },
  ];

  const reviewColumns: Column<Review>[] = [
    { key: 'customerName', header: 'Customer', sortable: true },
    { key: 'orderNumber', header: 'Order' },
    {
      key: 'rating',
      header: 'Rating',
      sortable: true,
      render: (row) => <StarRating rating={row.rating} />,
    },
    {
      key: 'comment',
      header: 'Review',
      className: 'max-w-xs',
      render: (row) => row.comment ? (
        <p className="text-xs italic text-muted-foreground line-clamp-2 max-w-xs">&ldquo;{row.comment}&rdquo;</p>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      render: (row) => new Date(row.createdAt).toLocaleDateString('en-KE'),
    },
    {
      key: 'id',
      header: 'Actions',
      render: (row) =>
        row.status === 'pending' ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => moderateMutation.mutate({ reviewId: row.id, action: 'approved' })}
              disabled={moderateMutation.isPending}
            >
              <ThumbsUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => moderateMutation.mutate({ reviewId: row.id, action: 'rejected' })}
              disabled={moderateMutation.isPending}
            >
              <ThumbsDown className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reviews & Moderation" description="Monitor customer feedback and moderate reviews" />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-card border-border/50">
                <CardContent className="p-5">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))
          : reviewStats.map((stat) => (
              <Card key={stat.label} className="bg-card border-border/50">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Reviews Table */}
      <DataTable
        data={reviews}
        columns={reviewColumns}
        searchPlaceholder="Search reviews..."
        onRowClick={(row) => setSelectedReview(row)}
      />

      {/* Review Detail Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={(open) => { if (!open) setSelectedReview(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Customer</p>
                <p className="text-sm font-medium">{selectedReview.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Order</p>
                <p className="text-sm font-medium">{selectedReview.orderNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Rating</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${star <= selectedReview.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                    />
                  ))}
                  <span className="font-medium ml-2 text-sm">{selectedReview.rating}/5</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Comment</p>
                <div className="bg-muted/40 rounded-lg px-4 py-3 border border-border/50">
                  <p className="text-sm italic leading-relaxed">&ldquo;{selectedReview.comment || 'No comment'}&rdquo;</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Date</p>
                <p className="text-sm font-medium">
                  {new Date(selectedReview.createdAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                <StatusBadge status={selectedReview.status} />
              </div>
              {selectedReview.status === 'pending' && (
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                    onClick={() => {
                      moderateMutation.mutate({ reviewId: selectedReview.id, action: 'approved' });
                      setSelectedReview(null);
                    }}
                    disabled={moderateMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => {
                      moderateMutation.mutate({ reviewId: selectedReview.id, action: 'rejected' });
                      setSelectedReview(null);
                    }}
                    disabled={moderateMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewsModeration;
