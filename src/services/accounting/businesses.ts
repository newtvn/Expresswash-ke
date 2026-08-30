import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';
import type { Business } from '@/types/business';

function mapBusiness(row: Record<string, unknown>): Business {
  return {
    id: String(row.id ?? ''),
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    active: row.active !== false,
    isNative: Boolean(row.is_native),
  };
}

export async function listBusinesses(): Promise<Business[]> {
  const { data, error } = await retrySupabaseQuery(
    () => supabase.from('businesses').select('*').eq('active', true).order('name'),
    { maxRetries: 2 },
  );
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => mapBusiness(row as Record<string, unknown>));
}

export interface CreateBusinessInput {
  slug: string;
  name: string;
  sourceSystem?: string | null;
  isNative?: boolean;
}

export async function createBusiness(input: CreateBusinessInput): Promise<Business | null> {
  const { data, error } = await supabase
    .from('businesses')
    .insert({
      slug: input.slug,
      name: input.name,
      source_system: input.sourceSystem ?? null,
      is_native: input.isNative ?? false,
    })
    .select('*')
    .single();
  if (error || !data) return null;
  return mapBusiness(data as Record<string, unknown>);
}
