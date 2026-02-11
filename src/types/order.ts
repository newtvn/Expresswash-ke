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
  itemType?: string;
  lengthInches?: number;
  widthInches?: number;
  unitPrice?: number;
  totalPrice?: number;
}

export interface Order {
  id?: string;
  trackingCode: string;
  customerId?: string;
  customerName: string;
  status: number;
  items: OrderItem[];
  pickupDate: string;
  estimatedDelivery: string;
  zone: string;
  pickupAddress?: string;
  subtotal?: number;
  deliveryFee?: number;
  vat?: number;
  total?: number;
  notes?: string;
  driverName?: string;
  driverPhone?: string;
  createdAt?: string;
}

export interface TrackingResponse {
  success: boolean;
  order?: Order;
  error?: string;
}
