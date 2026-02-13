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

  // Exclude deleted users by default
  query = query.is('deleted_at', null);

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

/**
 * Soft delete a user (marks as deleted but preserves data for audit trail)
 * Also handles cleanup of related data
 */
export const softDeleteUser = async (
  userId: string,
  deletedBy: string,
): Promise<{ success: boolean; message?: string }> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // 1. Mark user profile as deleted (soft delete)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        email: `deleted_${userId}@deleted.local`, // Anonymize email
      })
      .eq('id', userId);

    if (profileError) {
      return { success: false, message: profileError.message };
    }

    // 2. Anonymize user's addresses (keep for order history)
    await supabase
      .from('addresses')
      .update({
        address: '[DELETED]',
        notes: '[DELETED]',
      })
      .eq('user_id', userId);

    // 3. Mark loyalty account as inactive (preserve points history for audit)
    await supabase
      .from('loyalty_accounts')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', userId);

    // 4. Note: Orders are kept for historical/financial records but anonymized customer info
    await supabase
      .from('orders')
      .update({
        customer_name: '[DELETED USER]',
        notes: '[User data deleted]',
      })
      .eq('customer_id', userId);

    // 5. Delete user from auth (this removes login capability)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      // Continue anyway - soft delete is more important than auth deletion
    }

    // 6. Log the deletion for audit trail
    await supabase.from('audit_logs').insert({
      user_id: deletedBy,
      action: 'delete_user',
      resource_type: 'user',
      resource_id: userId,
      details: {
        deleted_user_email: user.email,
        deleted_user_name: user.name,
        reason: 'Admin deletion',
      },
      created_at: new Date().toISOString(),
    });

    return { success: true, message: 'User deleted successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred' };
  }
};

/**
 * Hard delete a user (permanently removes all data - use with extreme caution)
 * Only use this for GDPR/legal compliance requests
 */
export const hardDeleteUser = async (
  userId: string,
  deletedBy: string,
  reason: string,
): Promise<{ success: boolean; message?: string }> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Log the hard deletion BEFORE deleting (for permanent audit trail)
    await supabase.from('audit_logs').insert({
      user_id: deletedBy,
      action: 'hard_delete_user',
      resource_type: 'user',
      resource_id: userId,
      details: {
        deleted_user_email: user.email,
        deleted_user_name: user.name,
        reason,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    // Delete in order of dependencies
    await supabase.from('addresses').delete().eq('user_id', userId);
    await supabase.from('loyalty_transactions').delete().eq('customer_id', userId);
    await supabase.from('loyalty_accounts').delete().eq('customer_id', userId);
    await supabase.from('referrals').delete().eq('referrer_id', userId);
    await supabase.from('referrals').delete().eq('referee_id', userId);

    // Note: Orders should typically be preserved for financial/legal reasons
    // If you must delete them, uncomment the line below
    // await supabase.from('orders').delete().eq('customer_id', userId);

    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);

    return { success: true, message: 'User permanently deleted' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred' };
  }
};
