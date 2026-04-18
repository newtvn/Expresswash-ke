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
  // Use atomic DB function to prevent balance/ledger drift
  const { data, error } = await supabase.rpc('redeem_loyalty_reward', {
    p_customer_id: customerId,
    p_reward_id: rewardId,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return {
    success: data.success as boolean,
    message: data.message as string,
    remainingPoints: (data.remaining_points as number) ?? undefined,
  };
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

  // Queue referral invite email
  const signupUrl = `https://expresswash.co.ke/signup?ref=${encodeURIComponent(code)}`;
  const emailBody =
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
    + '<h2 style="color: #2563eb;">You\'ve been invited to ExpressWash!</h2>'
    + `<p>${referrerName} thinks you'll love ExpressWash Kenya's carpet and fabric cleaning service. `
    + 'Sign up using their referral code and you\'ll both earn <strong>200 loyalty points</strong> on your first completed order!</p>'
    + '<div style="text-align: center; margin: 24px 0;">'
    + `<span style="display: inline-block; padding: 12px 24px; background: #f3f4f6; border-radius: 8px; font-family: monospace; font-size: 20px; font-weight: bold; letter-spacing: 2px;">${code}</span>`
    + '</div>'
    + `<p style="text-align: center;"><a href="${signupUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Sign Up Now</a></p>`
    + '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">'
    + '<p style="color: #6b7280; font-size: 12px; text-align: center;">ExpressWash Kenya - Professional Carpet &amp; Fabric Cleaning</p>'
    + '</div>';

  await supabase.from('notification_history').insert({
    template_name: 'Referral Invite',
    channel: 'email',
    recipient_id: null,
    recipient_name: email.split('@')[0],
    recipient_contact: email,
    subject: `${referrerName} invited you to try ExpressWash!`,
    body: emailBody,
    status: 'pending',
    sent_at: null,
    delivered_at: null,
  });

  return {
    success: true,
    referral: mapReferral(newReferral),
    message: `Referral invitation sent to ${email}`,
  };
};
