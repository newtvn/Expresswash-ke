import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';
import {
  LoyaltyAccount,
  LoyaltyTransaction,
  Reward,
  Referral,
} from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────

function mapLoyaltyAccount(row: Record<string, unknown>): LoyaltyAccount {
  return {
    customerId: row.customer_id as string,
    customerName: row.customer_name as string,
    points: row.points as number,
    tier: row.tier as LoyaltyAccount['tier'],
    tierProgress: row.tier_progress as number,
    lifetimePoints: row.lifetime_points as number,
    nextTier: (row.next_tier as LoyaltyAccount['tier']) ?? undefined,
    pointsToNextTier: (row.points_to_next_tier as number) ?? undefined,
  };
}

function mapTransaction(row: Record<string, unknown>): LoyaltyTransaction {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    points: row.points as number,
    type: row.type as LoyaltyTransaction['type'],
    description: row.description as string,
    orderId: (row.order_id as string) ?? undefined,
    balanceAfter: row.balance_after as number,
    createdAt: row.created_at as string,
  };
}

function mapReward(row: Record<string, unknown>): Reward {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    pointsCost: row.points_cost as number,
    discountType: row.discount_type as Reward['discountType'],
    discountValue: row.discount_value as number,
    isActive: row.is_active as boolean,
    validUntil: (row.valid_until as string) ?? undefined,
  };
}

function mapReferral(row: Record<string, unknown>): Referral {
  return {
    id: row.id as string,
    referrerId: row.referrer_id as string,
    referrerName: row.referrer_name as string,
    refereeId: (row.referee_id as string) ?? undefined,
    refereeName: (row.referee_name as string) ?? undefined,
    refereeEmail: row.referee_email as string,
    referralCode: row.referral_code as string,
    status: row.status as Referral['status'],
    pointsEarned: row.points_earned as number,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string) ?? undefined,
  };
}

// ── Public API ────────────────────────────────────────────────────────

export const getLoyaltyAccount = async (
  customerId: string,
): Promise<LoyaltyAccount | null> => {
  const { data } = await retrySupabaseQuery(
    () => supabase.from('loyalty_accounts').select('*').eq('customer_id', customerId).maybeSingle(),
    { maxRetries: 2 }
  );

  return data ? mapLoyaltyAccount(data) : null;
};

export const getLoyaltyTransactions = async (
  customerId: string,
): Promise<LoyaltyTransaction[]> => {
  const { data, error } = await retrySupabaseQuery(
    () => supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    { maxRetries: 2 }
  );

  if (error || !data) return [];
  return data.map(mapTransaction);
};

export const getRewards = async (): Promise<Reward[]> => {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.from('rewards').select('*').order('points_cost', { ascending: true }),
    { maxRetries: 2 }
  );

  if (error || !data) return [];
  return data.map(mapReward);
};

export const redeemReward = async (
  customerId: string,
  rewardId: string,
): Promise<{ success: boolean; message: string; remainingPoints?: number }> => {
  const { data: account } = await retrySupabaseQuery(
    () => supabase.from('loyalty_accounts').select('*').eq('customer_id', customerId).maybeSingle(),
    { maxRetries: 2 }
  );

  if (!account) {
    return { success: false, message: 'Loyalty account not found' };
  }

  const { data: reward } = await retrySupabaseQuery(
    () => supabase.from('rewards').select('*').eq('id', rewardId).single(),
    { maxRetries: 2 }
  );

  if (!reward) {
    return { success: false, message: 'Reward not found' };
  }
  if (!reward.is_active) {
    return { success: false, message: 'This reward is no longer available' };
  }
  if (account.points < reward.points_cost) {
    return { success: false, message: `Insufficient points. You need ${reward.points_cost - account.points} more points.` };
  }

  const newBalance = account.points - reward.points_cost;

  await retrySupabaseQuery(
    () => supabase
      .from('loyalty_accounts')
      .update({ points: newBalance, updated_at: new Date().toISOString() })
      .eq('customer_id', customerId),
    { maxRetries: 3 }
  );

  await retrySupabaseQuery(
    () => supabase.from('loyalty_transactions').insert({
      customer_id: customerId,
      points: -reward.points_cost,
      type: 'redeemed',
      description: `Redeemed: ${reward.name}`,
      balance_after: newBalance,
    }),
    { maxRetries: 3 }
  );

  return { success: true, message: `Successfully redeemed "${reward.name}"`, remainingPoints: newBalance };
};

export const getReferrals = async (
  customerId?: string,
): Promise<Referral[]> => {
  let query = supabase
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('referrer_id', customerId);
  }

  const { data, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });
  if (error || !data) return [];
  return data.map(mapReferral);
};

export const createReferral = async (
  referrerId: string,
  email: string,
): Promise<{ success: boolean; referral?: Referral; message: string }> => {
  const { data: account } = await retrySupabaseQuery(
    () => supabase.from('loyalty_accounts').select('customer_name').eq('customer_id', referrerId).maybeSingle(),
    { maxRetries: 2 }
  );

  if (!account) {
    return { success: false, message: 'Loyalty account not found' };
  }

  const { data: existing } = await retrySupabaseQuery(
    () => supabase
      .from('referrals')
      .select('id')
      .eq('referee_email', email)
      .neq('status', 'expired')
      .limit(1),
    { maxRetries: 2 }
  );

  if (existing && existing.length > 0) {
    return { success: false, message: 'This email has already been referred' };
  }

  const referrerName = account.customer_name as string;
  const code = `${referrerName.split(' ')[0].toUpperCase()}-REF-${new Date().getFullYear()}`;

  const { data: newReferral, error } = await retrySupabaseQuery(
    () => supabase
      .from('referrals')
      .insert({
        referrer_id: referrerId,
        referrer_name: referrerName,
        referee_email: email,
        referral_code: code,
        status: 'pending',
        points_earned: 0,
      })
      .select()
      .single(),
    { maxRetries: 3 }
  );

  if (error || !newReferral) {
    return { success: false, message: 'Failed to create referral' };
  }

  return {
    success: true,
    referral: mapReferral(newReferral),
    message: `Referral invitation sent to ${email}`,
  };
};
