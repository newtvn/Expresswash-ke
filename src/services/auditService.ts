import { supabase } from '@/lib/supabase';
import {
  AuditLogEntry,
  SystemLogEntry,
  AuditLogFilters,
  SystemLogFilters,
  PaginatedResponse,
} from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────

function mapAuditLog(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: row.id as string,
    timestamp: row.timestamp as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    userRole: row.user_role as string,
    action: row.action as string,
    entity: row.entity as string,
    entityId: (row.entity_id as string) ?? undefined,
    details: row.details as string,
    oldValue: (row.old_value as string) ?? undefined,
    newValue: (row.new_value as string) ?? undefined,
    ipAddress: row.ip_address as string,
    userAgent: (row.user_agent as string) ?? undefined,
    isSuspicious: (row.is_suspicious as boolean) ?? false,
  };
}

function mapSystemLog(row: Record<string, unknown>): SystemLogEntry {
  return {
    id: row.id as string,
    timestamp: row.timestamp as string,
    level: row.level as SystemLogEntry['level'],
    service: row.service as string,
    message: row.message as string,
    stackTrace: (row.stack_trace as string) ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
  };
}

// ── Public API ────────────────────────────────────────────────────────

export const getAuditLogs = async (
  filters: AuditLogFilters = { page: 1, limit: 20 },
): Promise<PaginatedResponse<AuditLogEntry>> => {
  let query = supabase.from('audit_logs').select('*', { count: 'exact' });

  if (filters.startDate) {
    query = query.gte('timestamp', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('timestamp', filters.endDate);
  }
  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters.action) {
    query = query.eq('action', filters.action);
  }
  if (filters.entity) {
    query = query.eq('entity', filters.entity);
  }
  if (filters.isSuspicious !== undefined) {
    query = query.eq('is_suspicious', filters.isSuspicious);
  }
  if (filters.search) {
    query = query.or(
      `details.ilike.%${filters.search}%,user_name.ilike.%${filters.search}%,action.ilike.%${filters.search}%`,
    );
  }

  const start = (filters.page - 1) * filters.limit;
  query = query.range(start, start + filters.limit - 1).order('timestamp', { ascending: false });

  const { data, count, error } = await query;

  if (error || !data) {
    return { data: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0 };
  }

  const total = count ?? 0;

  return {
    data: data.map(mapAuditLog),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
};

export const getSystemLogs = async (
  filters: SystemLogFilters = { page: 1, limit: 20 },
): Promise<PaginatedResponse<SystemLogEntry>> => {
  let query = supabase.from('system_logs').select('*', { count: 'exact' });

  if (filters.startDate) {
    query = query.gte('timestamp', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('timestamp', filters.endDate);
  }
  if (filters.level) {
    query = query.eq('level', filters.level);
  }
  if (filters.service) {
    query = query.eq('service', filters.service);
  }
  if (filters.search) {
    query = query.or(
      `message.ilike.%${filters.search}%,service.ilike.%${filters.search}%`,
    );
  }

  const start = (filters.page - 1) * filters.limit;
  query = query.range(start, start + filters.limit - 1).order('timestamp', { ascending: false });

  const { data, count, error } = await query;

  if (error || !data) {
    return { data: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0 };
  }

  const total = count ?? 0;

  return {
    data: data.map(mapSystemLog),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
};
