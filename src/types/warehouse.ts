export interface IntakeItem {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  itemName: string;
  itemType: string;
  quantity: number;
  conditionNotes: string;
  warehouseLocation?: string;
  receivedAt: string;
  receivedBy: string;
}

export interface ProcessingItem {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  itemName: string;
  itemType: string;
  quantity: number;
  stage: 'intake' | 'washing' | 'drying' | 'quality_check' | 'ready_for_dispatch';
  assignedTo?: string;
  startedAt?: string;
  estimatedCompletion?: string;
  warehouseLocation: string;
  daysInWarehouse: number;
}

export interface QualityCheckResult {
  id: string;
  itemId: string;
  orderId: string;
  passed: boolean;
  notes: string;
  checkedBy: string;
  checkedAt: string;
  issues?: string[];
}

export interface DispatchItem {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  zone: string;
  items: string[];
  totalItems: number;
  readySince: string;
  assignedDriver?: string;
  scheduledDelivery?: string;
}

export interface WarehouseStats {
  totalItems: number;
  inWashing: number;
  inDrying: number;
  inQualityCheck: number;
  readyForDispatch: number;
  overdueItems: number;
  capacityUsed: number;
  capacityTotal: number;
}
