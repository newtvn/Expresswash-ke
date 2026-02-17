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

/**
 * Status options for dropdowns/selects in UI
 */
export const ORDER_STATUS_OPTIONS = [
  { value: ORDER_STATUS.PENDING, label: ORDER_STATUS_LABELS[ORDER_STATUS.PENDING] },
  { value: ORDER_STATUS.CONFIRMED, label: ORDER_STATUS_LABELS[ORDER_STATUS.CONFIRMED] },
  { value: ORDER_STATUS.DRIVER_ASSIGNED, label: ORDER_STATUS_LABELS[ORDER_STATUS.DRIVER_ASSIGNED] },
  { value: ORDER_STATUS.PICKUP_SCHEDULED, label: ORDER_STATUS_LABELS[ORDER_STATUS.PICKUP_SCHEDULED] },
  { value: ORDER_STATUS.PICKED_UP, label: ORDER_STATUS_LABELS[ORDER_STATUS.PICKED_UP] },
  { value: ORDER_STATUS.IN_PROCESSING, label: ORDER_STATUS_LABELS[ORDER_STATUS.IN_PROCESSING] },
  { value: ORDER_STATUS.PROCESSING_COMPLETE, label: ORDER_STATUS_LABELS[ORDER_STATUS.PROCESSING_COMPLETE] },
  { value: ORDER_STATUS.QUALITY_CHECK, label: ORDER_STATUS_LABELS[ORDER_STATUS.QUALITY_CHECK] },
  { value: ORDER_STATUS.QUALITY_APPROVED, label: ORDER_STATUS_LABELS[ORDER_STATUS.QUALITY_APPROVED] },
  { value: ORDER_STATUS.READY_FOR_DELIVERY, label: ORDER_STATUS_LABELS[ORDER_STATUS.READY_FOR_DELIVERY] },
  { value: ORDER_STATUS.OUT_FOR_DELIVERY, label: ORDER_STATUS_LABELS[ORDER_STATUS.OUT_FOR_DELIVERY] },
  { value: ORDER_STATUS.DELIVERED, label: ORDER_STATUS_LABELS[ORDER_STATUS.DELIVERED] },
  { value: ORDER_STATUS.CANCELLED, label: ORDER_STATUS_LABELS[ORDER_STATUS.CANCELLED] },
  { value: ORDER_STATUS.REFUNDED, label: ORDER_STATUS_LABELS[ORDER_STATUS.REFUNDED] },
];

/**
 * Badge variants for different order statuses (for UI components)
 */
export const ORDER_STATUS_VARIANTS: Record<
  OrderStatusCode,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  [ORDER_STATUS.PENDING]: 'outline',
  [ORDER_STATUS.CONFIRMED]: 'secondary',
  [ORDER_STATUS.DRIVER_ASSIGNED]: 'secondary',
  [ORDER_STATUS.PICKUP_SCHEDULED]: 'secondary',
  [ORDER_STATUS.PICKED_UP]: 'default',
  [ORDER_STATUS.IN_PROCESSING]: 'default',
  [ORDER_STATUS.PROCESSING_COMPLETE]: 'default',
  [ORDER_STATUS.QUALITY_CHECK]: 'default',
  [ORDER_STATUS.QUALITY_APPROVED]: 'default',
  [ORDER_STATUS.READY_FOR_DELIVERY]: 'default',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'default',
  [ORDER_STATUS.DELIVERED]: 'default',
  [ORDER_STATUS.CANCELLED]: 'destructive',
  [ORDER_STATUS.REFUNDED]: 'destructive',
};

/**
 * Helper function to check if order is active (not cancelled, refunded, or delivered)
 */
export function isActiveOrder(status: number): boolean {
  return (
    status >= ORDER_STATUS.PENDING &&
    status <= ORDER_STATUS.OUT_FOR_DELIVERY &&
    status !== ORDER_STATUS.CANCELLED &&
    status !== ORDER_STATUS.REFUNDED
  );
}

/**
 * Helper function to check if order can be cancelled
 */
export function canCancelOrder(status: number): boolean {
  return status >= ORDER_STATUS.PENDING && status <= ORDER_STATUS.PICKUP_SCHEDULED;
}

/**
 * Helper function to check if order is completed
 */
export function isOrderCompleted(status: number): boolean {
  return status === ORDER_STATUS.DELIVERED;
}

/**
 * Helper function to check if order is cancelled or refunded
 */
export function isOrderCancelled(status: number): boolean {
  return status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.REFUNDED;
}
