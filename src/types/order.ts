export interface OrderItem {
  name: string;
  quantity: number;
}

export interface OrderStage {
  id: number;
  name: string;
  icon: string;
  description: string;
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
  driverName?: string;
  driverPhone?: string;
  driverId?: string;
  pickupAddress?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrackingResponse {
  success: boolean;
  order?: Order;
  error?: string;
}
