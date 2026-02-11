/**
 * Order status codes used throughout the application
 * Ensures consistency and prevents magic numbers
 */
export const ORDER_STATUS = {
  PENDING: 1,
  CONFIRMED: 2,
  DRIVER_ASSIGNED: 3,
  PICKUP_SCHEDULED: 4,
  PICKED_UP: 5,
  IN_PROCESSING: 6,
  PROCESSING_COMPLETE: 7,
  QUALITY_CHECK: 8,
  QUALITY_APPROVED: 9,
  READY_FOR_DELIVERY: 10,
  OUT_FOR_DELIVERY: 11,
  DELIVERED: 12,
  CANCELLED: 13,
  REFUNDED: 14,
} as const;

export type OrderStatusCode = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/**
 * Human-readable labels for order statuses
 */
export const ORDER_STATUS_LABELS: Record<OrderStatusCode, string> = {
  [ORDER_STATUS.PENDING]: 'Pending',
  [ORDER_STATUS.CONFIRMED]: 'Confirmed',
  [ORDER_STATUS.DRIVER_ASSIGNED]: 'Driver Assigned',
  [ORDER_STATUS.PICKUP_SCHEDULED]: 'Pickup Scheduled',
  [ORDER_STATUS.PICKED_UP]: 'Picked Up',
  [ORDER_STATUS.IN_PROCESSING]: 'In Processing',
  [ORDER_STATUS.PROCESSING_COMPLETE]: 'Processing Complete',
  [ORDER_STATUS.QUALITY_CHECK]: 'Quality Check',
  [ORDER_STATUS.QUALITY_APPROVED]: 'Quality Approved',
  [ORDER_STATUS.READY_FOR_DELIVERY]: 'Ready for Delivery',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Out for Delivery',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
  [ORDER_STATUS.CANCELLED]: 'Cancelled',
  [ORDER_STATUS.REFUNDED]: 'Refunded',
};

/**
 * Get the label for an order status code
 */
export function getOrderStatusLabel(statusCode: number): string {
  return ORDER_STATUS_LABELS[statusCode as OrderStatusCode] ?? 'Unknown Status';
}
