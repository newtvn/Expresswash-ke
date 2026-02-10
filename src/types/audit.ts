export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string;
  details: string;
  oldValue?: string;
  newValue?: string;
  ipAddress: string;
  userAgent?: string;
  isSuspicious: boolean;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  action?: string;
  entity?: string;
  isSuspicious?: boolean;
  search?: string;
  page: number;
  limit: number;
}

export interface SystemLogFilters {
  startDate?: string;
  endDate?: string;
  level?: string;
  service?: string;
  search?: string;
  page: number;
  limit: number;
}
