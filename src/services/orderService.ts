import { TrackingResponse } from "@/types";
import { getDemoOrder } from "@/data/mockOrders";

/**
 * Service for order tracking operations
 * Currently uses mock data, but structured to easily swap with real API calls
 */

const SIMULATED_DELAY = 1000; // 1 second

/**
 * Track an order by tracking code
 */
export const trackOrder = async (
  trackingCode: string
): Promise<TrackingResponse> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY));

  const order = getDemoOrder(trackingCode);

  if (order) {
    return {
      success: true,
      order,
    };
  } else {
    return {
      success: false,
      error: "Order not found. Please check your tracking code.",
    };
  }
};

/**
 * Future: Add more order-related APIs
 * - getOrderHistory()
 * - updateOrderStatus()
 * - cancelOrder()
 */
