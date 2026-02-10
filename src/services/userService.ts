import { supabase } from '@/lib/supabase';
import { UserProfile, UserListFilters, PaginatedResponse } from '@/types';

function mapProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    phone: row.phone as string,
    role: row.role as UserProfile['role'],
    zone: row.zone as string,
    avatarUrl: (row.avatar_url as string) ?? undefined,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    lastLoginAt: (row.last_login_at as string) ?? undefined,
    loyaltyPoints: (row.loyalty_points as number) ?? undefined,
    loyaltyTier: (row.loyalty_tier as UserProfile['loyaltyTier']) ?? undefined,
    totalOrders: (row.total_orders as number) ?? undefined,
    totalSpent: (row.total_spent as number) ?? undefined,
  };
}

export const getUsers = async (
  filters: UserListFilters = { page: 1, limit: 10 },
): Promise<PaginatedResponse<UserProfile>> => {
  let query = supabase.from('profiles').select('*', { count: 'exact' });

  if (filters.role) {
    query = query.eq('role', filters.role);
  }
  if (filters.zone) {
    query = query.ilike('zone', filters.zone);
  }
  if (filters.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }
  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`,
    );
  }

  const start = (filters.page - 1) * filters.limit;
  query = query.range(start, start + filters.limit - 1).order('created_at', { ascending: false });

  const { data, count, error } = await query;

  if (error || !data) {
    return { data: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0 };
  }

  return {
    data: data.map(mapProfile),
    total: count ?? 0,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil((count ?? 0) / filters.limit),
  };
};

export const getUserById = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return mapProfile(data);
};

export const updateUser = async (
  userId: string,
  updates: Partial<UserProfile>,
): Promise<{ success: boolean; user?: UserProfile }> => {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.zone !== undefined) dbUpdates.zone = updates.zone;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;

  const { error } = await supabase
    .from('profiles')
    .update(dbUpdates)
    .eq('id', userId);

  if (error) return { success: false };

  const user = await getUserById(userId);
  return { success: true, user: user ?? undefined };
};

export const toggleUserActive = async (
  userId: string,
): Promise<{ success: boolean; isActive?: boolean }> => {
  const user = await getUserById(userId);
  if (!user) return { success: false };

  const newActive = !user.isActive;
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: newActive })
    .eq('id', userId);

  if (error) return { success: false };
  return { success: true, isActive: newActive };
};
