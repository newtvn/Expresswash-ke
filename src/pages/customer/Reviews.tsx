import { useState } from 'react';
import { PageHeader, DataTable, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Star, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';

const mockReviews = [
  { id: '1', orderId: 'EW-2025-00380', date: '2025-01-23', rating: 5, comment: 'Excellent service! My carpet looks brand new.', status: 'published' },
  { id: '2', orderId: 'EW-2025-00365', date: '2025-01-21', rating: 4, comment: 'Good quality cleaning, delivery was slightly delayed.', status: 'published' },
  { id: '3', orderId: 'EW-2025-00350', date: '2025-01-19', rating: 5, comment: 'Very happy with the Persian rug cleaning. Great care taken.', status: 'published' },
  { id: '4', orderId: 'EW-2025-00320', date: '2025-01-13', rating: 3, comment: 'Decent job but some stains remained. Follow-up was good.', status: 'published' },
  { id: '5', orderId: 'EW-2025-00305', date: '2025-01-11', rating: 4, comment: 'Professional drivers and clean results.', status: 'pending' },
  { id: '6', orderId: 'EW-2025-00290', date: '2025-01-09', rating: 5, comment: 'Best carpet cleaning service in Kitengela!', status: 'published' },
];

const pendingOrders = [
  { orderId: 'EW-2025-00395', date: '2025-01-25', items: '3 Curtain Pairs' },
];

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

const columns: Column<(typeof mockReviews)[0]>[] = [
  { key: 'orderId', header: 'Order #', sortable: true },
  { key: 'date', header: 'Date', sortable: true },
  {
    key: 'rating',
    header: 'Rating',
    sortable: true,
    render: (row) => <StarRating rating={row.rating} />,
  },
  {
    key: 'comment',
    header: 'Comment',
    render: (row) => (
      <span className="text-sm line-clamp-2 max-w-xs">{row.comment}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export const Reviews = () => {
  const [writeOpen, setWriteOpen] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [selectedOrder, setSelectedOrder] = useState('');

  const handleSubmitReview = () => {
    if (!newRating || !newComment || !selectedOrder) return;
    setWriteOpen(false);
    setNewRating(0);
    setNewComment('');
    setSelectedOrder('');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Reviews" description="View and write reviews for completed orders">
        {pendingOrders.length > 0 && (
          <Button onClick={() => { setSelectedOrder(pendingOrders[0].orderId); setWriteOpen(true); }}>
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
                onClick={() => { setSelectedOrder(pendingOrders[0].orderId); setWriteOpen(true); }}
              >
                Review Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable
        data={mockReviews}
        columns={columns}
        searchable
        searchPlaceholder="Search reviews..."
        pageSize={10}
      />

      {/* Write Review Dialog */}
      <Dialog open={writeOpen} onOpenChange={setWriteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Order</Label>
              <p className="text-sm font-medium mt-1">{selectedOrder}</p>
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
            <Button onClick={handleSubmitReview} disabled={!newRating || !newComment}>
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reviews;
