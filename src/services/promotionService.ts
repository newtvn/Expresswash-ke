import { supabase } from '@/lib/supabase';

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  usage_limit: number | null;
  usage_per_customer: number;
  times_used: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  promotion_type: 'manual' | 'birthday' | 'referral' | 'seasonal' | 'winback';
  created_at: string;
}

export interface PromotionInput {
  name: string;
  description?: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_order_amount?: number | null;
  max_discount_amount?: number | null;
  usage_limit?: number | null;
  usage_per_customer?: number;
  valid_from: string;
  valid_until: string;
  promotion_type?: string;
}

// ---- ADMIN CRUD ----

export async function getAllPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('promotions')
    .insert({
      ...input,
      code: input.code.toUpperCase().trim(),
      is_active: true,
      times_used: 0,
      promotion_type: input.promotion_type || 'manual',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Promotion code "${input.code}" already exists`);
    }
    throw new Error(`Failed to create promotion: ${error.message}`);
  }
  return data;
}

export async function updatePromotion(id: string, input: Partial<PromotionInput>): Promise<Promotion> {
  const update: Record<string, unknown> = { ...input };
  if (input.code) update.code = input.code.toUpperCase().trim();

  const { data, error } = await supabase
    .from('promotions')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update: ${error.message}`);
  return data;
}

export async function togglePromotionActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('promotions')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function getPromotionUsage(promotionId: string) {
  const { data, error } = await supabase
    .from('promotion_usage')
    .select('*, profiles!customer_id(name, phone)')
    .eq('promotion_id', promotionId)
    .order('used_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ---- CUSTOMER-FACING: VALIDATE PROMO CODE ----

/**
 * Validate a promo code client-side before server-side pricing does authoritative validation.
 * @param code - The promo code to validate
 * @param orderSubtotal - Optional current order subtotal to check min_order_amount
 */
export async function validatePromoCode(code: string, orderSubtotal?: number): Promise<{
  valid: boolean;
  promotion?: Promotion;
  message: string;
}> {
  if (!code || code.trim().length === 0) {
    return { valid: false, message: 'Please enter a promo code' };
  }

  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return { valid: false, message: 'Invalid promo code' };
  }

  const now = new Date();
  const validFrom = new Date(data.valid_from);
  const validUntil = new Date(data.valid_until);

  if (now < validFrom) {
    return { valid: false, message: 'This promo code is not yet active' };
  }
  if (now > validUntil) {
    return { valid: false, message: 'This promo code has expired' };
  }
  if (data.usage_limit !== null && data.times_used >= data.usage_limit) {
    return { valid: false, message: 'This promo code has been fully redeemed' };
  }

  // Check minimum order amount
  if (data.min_order_amount !== null && orderSubtotal !== undefined && orderSubtotal < data.min_order_amount) {
    return {
      valid: false,
      message: `Minimum order of KES ${data.min_order_amount.toLocaleString()} required for this code`,
    };
  }

  // Check per-customer usage
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { count } = await supabase
      .from('promotion_usage')
      .select('*', { count: 'exact', head: true })
      .eq('promotion_id', data.id)
      .eq('customer_id', user.id);

    if (count !== null && count >= data.usage_per_customer) {
      return { valid: false, message: 'You have already used this promo code' };
    }
  }

  const discountText = data.discount_type === 'percentage'
    ? `${data.discount_value}% off`
    : `KES ${data.discount_value.toLocaleString()} off`;

  return {
    valid: true,
    promotion: data as Promotion,
    message: `${discountText} applied!${data.min_order_amount ? ` (Min order: KES ${data.min_order_amount.toLocaleString()})` : ''}`,
  };
}

/**
 * Record that a promotion was used (call after order is created).
 * Uses a single atomic RPC to insert usage and increment counter,
 * preventing drift if one of two separate calls were to fail.
 */
export async function recordPromotionUsage(
  promotionId: string,
  orderId: string,
  discountApplied: number,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.rpc('record_promotion_usage', {
    p_promotion_id: promotionId,
    p_customer_id: user.id,
    p_order_id: orderId,
    p_discount_applied: discountApplied,
  });

  if (error) {
    console.error('Failed to record promotion usage:', error.message);
  }
}
