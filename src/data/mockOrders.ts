import { Order } from "@/types";

/**
 * Demo/Mock order data for testing and development
 */
export const DEMO_ORDERS: Record<string, Order> = {
  "EW-2024-00123": {
    trackingCode: "EW-2024-00123",
    customerName: "Grace Wanjiku",
    status: 8,
    items: [
      { name: "Carpet (Large)", quantity: 2 },
      { name: "Sofa (3-Seater)", quantity: 1 },
      { name: "Curtain Pair", quantity: 3 },
    ],
    pickupDate: "Jan 22, 2024",
    estimatedDelivery: "Jan 24, 2024",
    zone: "Kitengela",
    driverName: "Joseph Mwangi",
    driverPhone: "+254 712 345 678",
  },
  "EW-2024-00124": {
    trackingCode: "EW-2024-00124",
    customerName: "John Kamau",
    status: 5,
    items: [
      { name: "Carpet (Medium)", quantity: 1 },
      { name: "Cushions", quantity: 6 },
    ],
    pickupDate: "Jan 23, 2024",
    estimatedDelivery: "Jan 25, 2024",
    zone: "Syokimau",
  },
};

/**
 * Get demo order by tracking code
 */
export const getDemoOrder = (trackingCode: string): Order | null => {
  return DEMO_ORDERS[trackingCode.toUpperCase()] || null;
};
