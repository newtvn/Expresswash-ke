import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ThumbsUp, ThumbsDown, MessageSquare, TrendingUp } from "lucide-react";

const reviewStats = [
  { label: "Average Rating", value: "0", icon: Star, color: "bg-yellow-100 text-yellow-600" },
  { label: "Total Reviews", value: "0", icon: MessageSquare, color: "bg-blue-100 text-blue-600" },
  { label: "Pending Approval", value: "0", icon: TrendingUp, color: "bg-orange-100 text-orange-600" },
  { label: "This Month", value: "0", icon: ThumbsUp, color: "bg-emerald-100 text-emerald-600" },
];

type Review = {
  id: string;
  customer: string;
  orderId: string;
  rating: number;
  review: string;
  status: string;
  date: string;
};

// TODO: Connect to real reviews service
const reviews: Review[] = [];

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

const reviewColumns: Column<Review>[] = [
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
        data={reviews}
        columns={reviewColumns}
        searchPlaceholder="Search reviews..."
      />
    </div>
  );
};

export default ReviewsModeration;
