import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';

// ── Types ────────────────────────────────────────────────────────────

export interface Address {
  id: string;
  customerId: string;
  label: string;
  addressLine: string;
  zone: string;
  isDefault: boolean;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}

const KNOWN_ZONES = ['Kitengela', 'Athi River', 'Syokimau', 'Mlolongo', 'Greater Nairobi', 'Nairobi'] as const;

/**
 * Try to extract a delivery zone from a formatted address string.
 * Returns the zone name if found, undefined otherwise.
 */
export function extractZoneFromAddress(address: string): string | undefined {
  const lower = address.toLowerCase();
  return KNOWN_ZONES.find((z) => lower.includes(z.toLowerCase()));
}

// ── Helpers ──────────────────────────────────────────────────────────

function mapAddress(row: Record<string, unknown>): Address {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    label: row.label as string,
    addressLine: row.address_line as string,
    zone: row.zone as string,
    isDefault: row.is_default as boolean,
    latitude: (row.latitude as number) ?? undefined,
    longitude: (row.longitude as number) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Public API ───────────────────────────────────────────────────────

export const getAddresses = async (
  customerId: string,
): Promise<Address[]> => {
  const { data, error } = await retrySupabaseQuery(
    () =>
      supabase
        .from('addresses')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false }),
    { maxRetries: 2 },
  );

  if (error || !data) return [];
  return data.map(mapAddress);
};

export const createAddress = async (
  data: {
    customerId: string;
    label: string;
    addressLine: string;
    zone: string;
    isDefault: boolean;
    latitude?: number;
    longitude?: number;
  },
): Promise<{ success: boolean; address?: Address }> => {
  // If setting as default, unset existing defaults first
  if (data.isDefault) {
    await retrySupabaseQuery(
      () =>
        supabase
          .from('addresses')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('customer_id', data.customerId)
          .eq('is_default', true),
      { maxRetries: 2 },
    );
  }

  const { data: newRow, error } = await retrySupabaseQuery(
    () =>
      supabase
        .from('addresses')
        .insert({
          customer_id: data.customerId,
          label: data.label,
          address_line: data.addressLine,
          zone: data.zone,
          is_default: data.isDefault,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        })
        .select()
        .single(),
    { maxRetries: 3 },
  );

  if (error || !newRow) {
    return { success: false };
  }

  return { success: true, address: mapAddress(newRow) };
};

export const updateAddress = async (
  id: string,
  data: Partial<{
    customerId: string;
    label: string;
    addressLine: string;
    zone: string;
    isDefault: boolean;
    latitude: number;
    longitude: number;
  }>,
): Promise<{ success: boolean }> => {
  // If setting as default, unset existing defaults first
  if (data.isDefault && data.customerId) {
    await retrySupabaseQuery(
      () =>
        supabase
          .from('addresses')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('customer_id', data.customerId)
          .eq('is_default', true),
      { maxRetries: 2 },
    );
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.label !== undefined) updatePayload.label = data.label;
  if (data.addressLine !== undefined) updatePayload.address_line = data.addressLine;
  if (data.zone !== undefined) updatePayload.zone = data.zone;
  if (data.isDefault !== undefined) updatePayload.is_default = data.isDefault;
  if (data.latitude !== undefined) updatePayload.latitude = data.latitude;
  if (data.longitude !== undefined) updatePayload.longitude = data.longitude;

  const { error } = await retrySupabaseQuery(
    () => supabase.from('addresses').update(updatePayload).eq('id', id),
    { maxRetries: 3 },
  );

  return { success: !error };
};

export const deleteAddress = async (
  id: string,
): Promise<{ success: boolean }> => {
  const { error } = await retrySupabaseQuery(
    () => supabase.from('addresses').delete().eq('id', id),
    { maxRetries: 2 },
  );

  return { success: !error };
};

export const getDefaultAddress = async (
  customerId: string,
): Promise<Address | null> => {
  const { data } = await retrySupabaseQuery(
    () =>
      supabase
        .from('addresses')
        .select('*')
        .eq('customer_id', customerId)
        .eq('is_default', true)
        .maybeSingle(),
    { maxRetries: 2 },
  );

  return data ? mapAddress(data) : null;
};
