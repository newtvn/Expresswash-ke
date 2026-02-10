import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ThumbsUp, ThumbsDown, MessageSquare, TrendingUp } from "lucide-react";

const reviewStats = [
  { label: "Average Rating", value: "4.7", icon: Star, color: "bg-yellow-100 text-yellow-600" },
  { label: "Total Reviews", value: "1,284", icon: MessageSquare, color: "bg-blue-100 text-blue-600" },
  { label: "Pending Approval", value: "8", icon: TrendingUp, color: "bg-orange-100 text-orange-600" },
  { label: "This Month", value: "42", icon: ThumbsUp, color: "bg-emerald-100 text-emerald-600" },
];

const mockReviews = [
  { id: "R-501", customer: "Grace Wanjiku", orderId: "EW-2024-01250", rating: 5, review: "Excellent service! My carpets look brand new. Very professional team.", status: "approved", date: "2024-12-14" },
  { id: "R-502", customer: "Peter Kamau", orderId: "EW-2024-01248", rating: 4, review: "Good job on the curtains. Delivery was on time. Minor wrinkle issue.", status: "approved", date: "2024-12-13" },
  { id: "R-503", customer: "Mary Njeri", orderId: "EW-2024-01245", rating: 5, review: "Fantastic! The mattress sanitization was thorough. Will definitely use again.", status: "approved", date: "2024-12-12" },
  { id: "R-504", customer: "John Odera", orderId: "EW-2024-01240", rating: 2, review: "Delivery was delayed by two days. Cleaning was okay but not worth the wait.", status: "pending", date: "2024-12-11" },
  { id: "R-505", customer: "Sarah Wambui", orderId: "EW-2024-01238", rating: 5, review: "Love the sofa cleaning result! Looks amazing. Great customer support.", status: "approved", date: "2024-12-10" },
  { id: "R-506", customer: "David Maina", orderId: "EW-2024-01235", rating: 3, review: "Average experience. Carpet cleaning was fine but could be better.", status: "pending", date: "2024-12-09" },
  { id: "R-507", customer: "Faith Akinyi", orderId: "EW-2024-01230", rating: 4, review: "Happy with the chair cleaning. Professional service overall.", status: "approved", date: "2024-12-08" },
  { id: "R-508", customer: "James Mwangi", orderId: "EW-2024-01228", rating: 1, review: "Very poor experience. Items returned with stains still visible. Unacceptable.", status: "pending", date: "2024-12-07" },
];

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`w-4 h-4 ${
          star <= rating
            ? "text-yellow-500 fill-yellow-500"
            : "text-gray-200"
        }`}
      />
    ))}
  </div>
);

const reviewColumns: Column<(typeof mockReviews)[0]>[] = [
  { key: "customer", header: "Customer", sortable: true },
  { key: "orderId", header: "Order" },
  {
    key: "rating",
    header: "Rating",
    sortable: true,
    render: (row) => <StarRating rating={row.rating} />,
  },
  {
    key: "review",
    header: "Review",
    className: "max-w-xs",
    render: (row) => (
      <p className="text-sm text-muted-foreground truncate max-w-xs">
        {row.review}
      </p>
    ),
  },
  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  { key: "date", header: "Date", sortable: true },
  {
    key: "id",
    header: "Actions",
    render: (row) =>
      row.status === "pending" ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
            <ThumbsUp className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
            <ThumbsDown className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">--</span>
      ),
  },
];

/**
 * Admin Reviews & Moderation Page
 * Reviews table with ratings, approve/reject actions, and summary stats.
 */
export const ReviewsModeration = () => {
  return (
    <div className="space-y-6">
      <PageHeader title="Reviews & Moderation" description="Monitor customer feedback and moderate reviews" />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reviewStats.map((stat) => (
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
        data={mockReviews}
        columns={reviewColumns}
        searchPlaceholder="Search reviews..."
      />
    </div>
  );
};

export default ReviewsModeration;
