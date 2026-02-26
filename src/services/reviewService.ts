import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';

// ── Types ────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  rating: number;
  serviceRating: number;
  driverRating: number;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  adminResponse?: string;
  isPublic: boolean;
  createdAt: string;
}

export interface ReviewSubmission {
  orderId: string;
  rating: number;
  serviceRating?: number;
  driverRating?: number;
  comment: string;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  pendingCount: number;
  thisMonthCount: number;
}

export interface UnreviewedOrder {
  id: string;
  trackingCode: string;
  customerName: string;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Map a review row (with joined order data) to a Review object.
 * Queries use `reviews(*, orders(tracking_code, customer_name))` joins.
 */
function mapReview(row: Record<string, unknown>): Review {
  const order = row.orders as Record<string, unknown> | null;
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    orderNumber: (order?.tracking_code as string) ?? '',
    customerId: row.customer_id as string,
    customerName: (order?.customer_name as string) ?? '',
    rating: row.overall_rating as number,
    serviceRating: (row.service_rating as number) ?? 0,
    driverRating: (row.driver_rating as number) ?? 0,
    comment: (row.review_text as string) ?? '',
    status: row.status as Review['status'],
    adminResponse: (row.admin_response as string) ?? undefined,
    isPublic: (row.is_public as boolean) ?? false,
    createdAt: row.created_at as string,
  };
}

// Select expression that joins the order for tracking_code + customer_name
const REVIEW_SELECT = '*, orders(tracking_code, customer_name)';

// ── Customer Functions ───────────────────────────────────────────────

/**
 * Submit a new review (customer)
 */
export async function submitReview(
  review: ReviewSubmission,
  customerId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await retrySupabaseQuery(
    () =>
      supabase.from('reviews').insert({
        order_id: review.orderId,
        customer_id: customerId,
        overall_rating: review.rating,
        service_rating: review.serviceRating ?? review.rating,
        driver_rating: review.driverRating ?? review.rating,
        review_text: review.comment,
        status: 'pending',
        is_public: true,
      }),
    { maxRetries: 3 },
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Get current customer's reviews
 */
export async function getMyReviews(customerId: string): Promise<Review[]> {
  const { data, error } = await retrySupabaseQuery(
    () =>
      supabase
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false }),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapReview);
}

/**
 * Get delivered orders that don't have a review yet
 */
export async function getDeliveredOrdersWithoutReview(
  customerId: string,
): Promise<UnreviewedOrder[]> {
  // Status 12 = delivered
  const { data: orders, error: ordersError } = await retrySupabaseQuery(
    () =>
      supabase
        .from('orders')
        .select('id, tracking_code, customer_name, created_at')
        .eq('customer_id', customerId)
        .eq('status', 12)
        .order('created_at', { ascending: false }),
    { maxRetries: 2 },
  );

  if (ordersError || !orders || orders.length === 0) return [];

  // Get orders that already have reviews
  const orderIds = orders.map((o) => o.id);
  const { data: reviewed } = await retrySupabaseQuery(
    () =>
      supabase
        .from('reviews')
        .select('order_id')
        .in('order_id', orderIds),
    { maxRetries: 2 },
  );

  const reviewedIds = new Set((reviewed ?? []).map((r) => r.order_id));

  return orders
    .filter((o) => !reviewedIds.has(o.id))
    .map((o) => ({
      id: o.id,
      trackingCode: o.tracking_code,
      customerName: o.customer_name,
      createdAt: o.created_at,
    }));
}

// ── Public Functions ─────────────────────────────────────────────────

/**
 * Get approved public reviews (for homepage/public display)
 */
export async function getPublicReviews(limit = 10): Promise<Review[]> {
  const { data, error } = await retrySupabaseQuery(
    () =>
      supabase
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq('status', 'approved')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(limit),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapReview);
}

// ── Admin Functions ──────────────────────────────────────────────────

/**
 * Get pending reviews for moderation
 */
export async function getPendingReviews(): Promise<Review[]> {
  const { data, error } = await retrySupabaseQuery(
    () =>
      supabase
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapReview);
}

/**
 * Get all reviews with optional status filter (admin)
 */
export async function getAllReviews(status?: string): Promise<Review[]> {
  let query = supabase
    .from('reviews')
    .select(REVIEW_SELECT)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });

  if (error || !data) return [];
  return data.map(mapReview);
}

/**
 * Moderate a review (approve/reject with optional admin response)
 */
export async function moderateReview(
  reviewId: string,
  action: 'approved' | 'rejected',
  adminResponse?: string,
): Promise<{ success: boolean; error?: string }> {
  const updateData: Record<string, unknown> = {
    status: action,
    updated_at: new Date().toISOString(),
  };
  if (adminResponse) {
    updateData.admin_response = adminResponse;
  }

  const { error } = await retrySupabaseQuery(
    () => supabase.from('reviews').update(updateData).eq('id', reviewId),
    { maxRetries: 3 },
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Get review statistics for admin dashboard
 */
export async function getReviewStats(): Promise<ReviewStats> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.from('reviews').select('overall_rating, status, created_at'),
    { maxRetries: 2 },
  );

  if (error || !data || data.length === 0) {
    return { averageRating: 0, totalReviews: 0, pendingCount: 0, thisMonthCount: 0 };
  }

  const totalReviews = data.length;
  const avgRating =
    data.reduce((sum, r) => sum + (r.overall_rating as number), 0) / totalReviews;
  const pendingCount = data.filter((r) => r.status === 'pending').length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonthCount = data.filter((r) => (r.created_at as string) >= monthStart).length;

  return {
    averageRating: Math.round(avgRating * 10) / 10,
    totalReviews,
    pendingCount,
    thisMonthCount,
  };
}
