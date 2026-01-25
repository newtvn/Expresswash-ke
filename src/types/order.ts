/**
 * Order tracking types and interfaces
 */

export interface OrderStage {
  id: number;
  name: string;
  icon: string;
  description: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
}

export interface Order {
  trackingCode: string;
  customerName: string;
  status: number;
  items: OrderItem[];
  pickupDate: string;
  estimatedDelivery: string;
  zone: string;
  driverName?: string;
  driverPhone?: string;
}

export interface TrackingResponse {
  success: boolean;
  order?: Order;
  error?: string;
}
