import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, DataTable, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Star, PenLine, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/config/queryKeys';
import {
  getMyReviews,
  getDeliveredOrdersWithoutReview,
  submitReview,
  type Review,
} from '@/services/reviewService';

function StarRating({ rating, onRate, interactive = false }: { rating: number; onRate?: (r: number) => void; interactive?: boolean }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-4 w-4',
            star <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground',
            interactive && 'cursor-pointer h-6 w-6 hover:text-yellow-400'
          )}
          onClick={() => interactive && onRate?.(star)}
        />
      ))}
    </div>
  );
}

const columns: Column<Review>[] = [
  { key: 'orderNumber', header: 'Order #', sortable: true },
  {
    key: 'createdAt',
    header: 'Date',
    sortable: true,
    render: (row) => new Date(row.createdAt).toLocaleDateString('en-KE'),
  },
  {
    key: 'rating',
    header: 'Rating',
    sortable: true,
    render: (row) => <StarRating rating={row.rating} />,
  },
  {
    key: 'comment',
    header: 'Comment',
    render: (row) => row.comment ? (
      <p className="text-xs italic text-muted-foreground line-clamp-2 max-w-xs">&ldquo;{row.comment}&rdquo;</p>
    ) : (
      <span className="text-xs text-muted-foreground">-</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export const Reviews = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [writeOpen, setWriteOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrderNumber, setSelectedOrderNumber] = useState('');

  const { data: myReviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: queryKeys.reviews.myReviews(),
    queryFn: () => getMyReviews(user?.id ?? ''),
    enabled: !!user?.id,
  });

  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['reviews', 'unreviewed', user?.id],
    queryFn: () => getDeliveredOrdersWithoutReview(user?.id ?? ''),
    enabled: !!user?.id,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitReview(
        {
          orderId: selectedOrderId,
          rating: newRating,
          comment: newComment,
        },
        user?.id ?? '',
      ),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Review submitted! It will appear after moderation.');
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
        queryClient.invalidateQueries({ queryKey: ['reviews', 'unreviewed'] });
        setWriteOpen(false);
        setNewRating(0);
        setNewComment('');
        setSelectedOrderId('');
        setSelectedOrderNumber('');
      } else {
        toast.error(result.error ?? 'Failed to submit review');
      }
    },
    onError: () => {
      toast.error('Failed to submit review');
    },
  });

  const openWriteDialog = (orderId?: string, orderNumber?: string) => {
    setSelectedOrderId(orderId ?? (pendingOrders[0]?.id ?? ''));
    setSelectedOrderNumber(orderNumber ?? (pendingOrders[0]?.trackingCode ?? ''));
    setNewRating(0);
    setNewComment('');
    setWriteOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Reviews" description="View and write reviews for completed orders">
        {pendingOrders.length > 0 && (
          <Button onClick={() => openWriteDialog()}>
            <PenLine className="mr-2 h-4 w-4" />
            Write Review
          </Button>
        )}
      </PageHeader>

      {/* Pending Reviews Banner */}
      {pendingOrders.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">You have {pendingOrders.length} order(s) waiting for a review</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Share your feedback to help us improve our services
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openWriteDialog()}
              >
                Review Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable
        data={myReviews}
        columns={columns}
        searchable
        searchPlaceholder="Search reviews..."
        pageSize={10}
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
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Order</p>
                <p className="text-sm font-medium">{selectedReview.orderNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Rating</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'w-5 h-5',
                        star <= selectedReview.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
                      )}
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Write Review Dialog */}
      <Dialog open={writeOpen} onOpenChange={setWriteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Order</Label>
              {pendingOrders.length > 1 ? (
                <Select
                  value={selectedOrderId}
                  onValueChange={(v) => {
                    setSelectedOrderId(v);
                    const order = pendingOrders.find((o) => o.id === v);
                    setSelectedOrderNumber(order?.trackingCode ?? '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an order" />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingOrders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.trackingCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm font-medium mt-1">{selectedOrderNumber}</p>
              )}
            </div>
            <div>
              <Label>Rating</Label>
              <div className="mt-2">
                <StarRating rating={newRating} onRate={setNewRating} interactive />
              </div>
            </div>
            <div>
              <Label htmlFor="review-comment">Comment</Label>
              <Textarea
                id="review-comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your experience..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWriteOpen(false)}>Cancel</Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={!newRating || !newComment || !selectedOrderId || submitMutation.isPending}
            >
              {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reviews;
