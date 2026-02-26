import { supabase } from '@/lib/supabase';

export interface Zone {
  id: string;
  name: string;
  delivery_policy: 'same_day' | '48_hour';
  delivery_days: string[] | null;
  base_delivery_fee: number;
  cutoff_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ZoneInput {
  name: string;
  delivery_policy: 'same_day' | '48_hour';
  delivery_days?: string[] | null;
  base_delivery_fee: number;
  cutoff_time?: string | null;
  is_active?: boolean;
}

// ---- READ (public) ----

export async function getActiveZones(): Promise<Zone[]> {
  const { data, error } = await supabase
    .from('zones')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw new Error(`Failed to fetch zones: ${error.message}`);
  return data || [];
}

export async function getZoneByName(name: string): Promise<Zone | null> {
  const { data, error } = await supabase
    .from('zones')
    .select('*')
    .eq('name', name)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch zone: ${error.message}`);
  }
  return data;
}

/**
 * Calculate delivery fee and estimated delivery based on zone.
 * Replaces hardcoded zone logic in the frontend.
 */
export function calculateDeliveryInfo(zone: Zone): {
  fee: number;
  estimatedDelivery: string;
  nextDeliveryDate: Date | null;
} {
  const fee = zone.base_delivery_fee;

  if (zone.delivery_policy === 'same_day') {
    const now = new Date();
    const [cutoffH, cutoffM] = (zone.cutoff_time || '12:00:00').split(':').map(Number);
    const cutoff = new Date();
    cutoff.setHours(cutoffH, cutoffM, 0, 0);

    if (now < cutoff) {
      return {
        fee,
        estimatedDelivery: 'Same-day delivery (by 6 PM)',
        nextDeliveryDate: now,
      };
    } else {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        fee,
        estimatedDelivery: 'Next-day delivery (ordered after cutoff)',
        nextDeliveryDate: tomorrow,
      };
    }
  }

  // 48-hour delivery policy
  if (zone.delivery_policy === '48_hour' && zone.delivery_days) {
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const deliveryDayNumbers = zone.delivery_days.map((d) => dayMap[d.toLowerCase()]);
    const now = new Date();

    // Find next delivery day that's at least 2 days from now
    let nextDate: Date | null = null;
    for (let i = 2; i <= 9; i++) {
      const candidateDate = new Date(now);
      candidateDate.setDate(candidateDate.getDate() + i);
      if (deliveryDayNumbers.includes(candidateDate.getDay())) {
        nextDate = candidateDate;
        break;
      }
    }

    const dayNames = zone.delivery_days.map(
      (d) => d.charAt(0).toUpperCase() + d.slice(1),
    );

    return {
      fee,
      estimatedDelivery: `Delivery on ${dayNames.join(', ')} (48-hour processing)`,
      nextDeliveryDate: nextDate,
    };
  }

  return { fee, estimatedDelivery: 'Standard delivery', nextDeliveryDate: null };
}

// ---- ADMIN CRUD ----

export async function getAllZones(): Promise<Zone[]> {
  const { data, error } = await supabase
    .from('zones')
    .select('*')
    .order('name');

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createZone(input: ZoneInput): Promise<Zone> {
  const { data, error } = await supabase
    .from('zones')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`Failed to create zone: ${error.message}`);
  return data;
}

export async function updateZone(id: string, input: Partial<ZoneInput>): Promise<Zone> {
  const { data, error } = await supabase
    .from('zones')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update zone: ${error.message}`);
  return data;
}

export async function toggleZoneActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('zones')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to toggle zone: ${error.message}`);
}
