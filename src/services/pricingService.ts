import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';

export interface PricingConfig {
  pricePerSqInch: {
    carpet: number;
    rug: number;
    curtain: number;
    sofa: number;
    mattress: number;
    chair: number;
    pillow: number;
    other: number;
  };
  deliveryFees: {
    kitengela: number;
    'athi river': number;
    syokimau: number;
    nairobi: number;
    other: number;
  };
  vatRate: number;
  minimumOrder: number;
}

export interface PricingConfigResponse {
  id: string;
  config: PricingConfig;
  updated_at: string;
  updated_by: string;
}

// Validation constants
const MIN_PRICE_PER_SQ_INCH = 0.1; // KES
const MAX_PRICE_PER_SQ_INCH = 10.0; // KES
const MIN_DELIVERY_FEE = 100; // KES
const MAX_DELIVERY_FEE = 2000; // KES
const MIN_VAT_RATE = 0.0; // 0%
const MAX_VAT_RATE = 0.3; // 30%
const MIN_ORDER_AMOUNT = 100; // KES

/**
 * Validate pricing configuration before saving
 */
export function validatePricingConfig(config: PricingConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate item prices
  Object.entries(config.pricePerSqInch).forEach(([key, value]) => {
    if (value < MIN_PRICE_PER_SQ_INCH || value > MAX_PRICE_PER_SQ_INCH) {
      errors.push(`${key} price must be between ${MIN_PRICE_PER_SQ_INCH} and ${MAX_PRICE_PER_SQ_INCH} KES`);
    }
  });

  // Validate delivery fees
  Object.entries(config.deliveryFees).forEach(([key, value]) => {
    if (value < MIN_DELIVERY_FEE || value > MAX_DELIVERY_FEE) {
      errors.push(`${key} delivery fee must be between ${MIN_DELIVERY_FEE} and ${MAX_DELIVERY_FEE} KES`);
    }
  });

  // Validate VAT rate
  if (config.vatRate < MIN_VAT_RATE || config.vatRate > MAX_VAT_RATE) {
    errors.push(`VAT rate must be between ${MIN_VAT_RATE * 100}% and ${MAX_VAT_RATE * 100}%`);
  }

  // Validate minimum order
  if (config.minimumOrder < MIN_ORDER_AMOUNT) {
    errors.push(`Minimum order must be at least ${MIN_ORDER_AMOUNT} KES`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get the current pricing configuration
 */
export async function getPricingConfig(): Promise<{ success: boolean; config?: PricingConfig; error?: string }> {
  try {
    const { data, error } = await retrySupabaseQuery(
      () => supabase
        .from('system_config')
        .select('*')
        .eq('id', 'pricing')
        .single(),
      { maxRetries: 2 }
    );

    if (error || !data) {
      return { success: false, error: 'Failed to fetch pricing configuration' };
    }

    return { success: true, config: data.config as PricingConfig };
  } catch (error) {
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update pricing configuration
 * Requires super_admin role
 */
export async function updatePricingConfig(
  config: PricingConfig,
  userId: string,
): Promise<{ success: boolean; message?: string; errors?: string[] }> {
  // Validate configuration
  const validation = validatePricingConfig(config);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  try {
    const { error } = await retrySupabaseQuery(
      () => supabase
        .from('system_config')
        .upsert({
          id: 'pricing',
          config,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        }),
      { maxRetries: 3 }
    );

    if (error) {
      return { success: false, message: error.message };
    }

    // Log the pricing change to audit logs
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'update_pricing',
      resource_type: 'system_config',
      resource_id: 'pricing',
      details: { config },
      created_at: new Date().toISOString(),
    }).catch(() => {
      // Non-critical, log silently
    });

    return { success: true, message: 'Pricing configuration updated successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred while updating pricing' };
  }
}

/**
 * Get pricing change history from audit logs
 */
export async function getPricingHistory(limit = 10): Promise<{
  success: boolean;
  history?: Array<{
    id: string;
    userId: string;
    userName: string;
    timestamp: string;
    changes: PricingConfig;
  }>;
}> {
  try {
    const { data, error } = await retrySupabaseQuery(
      () => supabase
        .from('audit_logs')
        .select('*, profiles(name)')
        .eq('action', 'update_pricing')
        .order('created_at', { ascending: false })
        .limit(limit),
      { maxRetries: 2 }
    );

    if (error || !data) {
      return { success: false };
    }

    const history = data.map((log) => ({
      id: log.id as string,
      userId: log.user_id as string,
      userName: (log.profiles as { name?: string } | null)?.name ?? 'Unknown',
      timestamp: log.created_at as string,
      changes: log.details?.config as PricingConfig,
    }));

    return { success: true, history };
  } catch (error) {
    return { success: false };
  }
}
