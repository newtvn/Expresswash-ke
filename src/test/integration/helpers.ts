/**
 * Integration test helpers — uses a REAL Supabase connection.
 * No mocks, no jsdom. Hits the live database.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Environment ──────────────────────────────────────────────────────
const SUPABASE_URL = 'https://bsmlzvenkeumebfbpsab.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbWx6dmVua2V1bWViZmJwc2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODkyNTAsImV4cCI6MjA4ODA2NTI1MH0.sv4TsAtJy4cPqZsj4BN_U-NdfB2XwwuVdDmAqUAU6BU';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbWx6dmVua2V1bWViZmJwc2FiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ4OTI1MCwiZXhwIjoyMDg4MDY1MjUwfQ.ZdblNUkLF8qWwrHjrJVs5BhV302aPrN2S7Fsxfpw5g4';

// ── Test accounts ────────────────────────────────────────────────────
export const TEST_ACCOUNTS = {
  customer: {
    email: 'ngethenan768+user@gmail.com',
    password: 'TestExpressWash2026!',
    id: '25776d85-3068-49cf-858c-49404f903cdc',
    name: 'Test Customer',
    role: 'customer' as const,
    zone: 'kitengela',
  },
  driver: {
    email: 'ngethenan768+driver@gmail.com',
    password: 'TestExpressWash2026!',
    id: '6736e857-d573-48d4-9aed-7ba57a918516',
    name: 'Test Driver',
    role: 'driver' as const,
    zone: 'kitengela',
  },
  admin: {
    email: 'ngethenan768@gmail.com',
    password: 'TestExpressWash2026!',
    id: 'ca2e02b3-aa10-4787-942a-fd707511d1e1',
    name: 'Nathan Ngethe',
    role: 'admin' as const,
    zone: 'kitengela',
  },
} as const;

// ── Admin client (bypasses RLS) ──────────────────────────────────────
export const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Per-user authenticated client factory ────────────────────────────
export async function getAuthenticatedClient(
  email: string,
  password: string,
): Promise<{ client: SupabaseClient; accessToken: string; userId: string }> {
  const maxAttempts = 3;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (!error && data.session) {
      return {
        client,
        accessToken: data.session.access_token,
        userId: data.user.id,
      };
    }

    lastError = error?.message ?? 'no session';
    if (attempt < maxAttempts) {
      // Wait before retry (1s, 2s)
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }

  throw new Error(`Auth failed for ${email} after ${maxAttempts} attempts: ${lastError}`);
}

// ── Cleanup tracker ──────────────────────────────────────────────────
// Stores IDs of records created during tests so they can be removed afterwards.
interface CleanupEntry {
  table: string;
  id: string;
  column?: string; // default: 'id'
}

const cleanupQueue: CleanupEntry[] = [];

export function trackForCleanup(table: string, id: string, column = 'id') {
  cleanupQueue.push({ table, id, column });
}

/**
 * Delete all tracked records in reverse order (to respect FK ordering).
 * Uses the service-role client so RLS is bypassed.
 */
export async function runCleanup() {
  const reversed = [...cleanupQueue].reverse();
  for (const { table, id, column } of reversed) {
    await adminClient.from(table).delete().eq(column ?? 'id', id);
  }
  cleanupQueue.length = 0;
}

// ── Shared test data for realistic scenarios ─────────────────────────

/** Realistic carpet / rug order mimicking a Kitengela household */
export const REALISTIC_ORDER_ITEMS = [
  {
    name: 'Living Room Persian Carpet',
    itemType: 'carpet',
    quantity: 1,
    lengthInches: 120,
    widthInches: 96,
    pricePerSqInch: 0.35,
    unitPrice: Math.round(120 * 96 * 0.35), // 4032
    totalPrice: Math.round(120 * 96 * 0.35), // 4032
  },
  {
    name: 'Bedroom Shaggy Rug',
    itemType: 'rug',
    quantity: 2,
    lengthInches: 72,
    widthInches: 48,
    pricePerSqInch: 0.40,
    unitPrice: Math.round(72 * 48 * 0.40), // 1382
    totalPrice: Math.round(72 * 48 * 0.40) * 2, // 2764 (approximate due to rounding)
  },
  {
    name: 'Dining Chair Cushion Covers',
    itemType: 'chair',
    quantity: 6,
    lengthInches: 18,
    widthInches: 18,
    pricePerSqInch: 0.45,
    unitPrice: Math.round(18 * 18 * 0.45), // 146
    totalPrice: Math.round(18 * 18 * 0.45) * 6, // 876
  },
];

export function computeOrderTotals(items: typeof REALISTIC_ORDER_ITEMS, zone: string) {
  const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
  const deliveryFee = getDeliveryFeeForZone(zone);
  const vat = Math.round((subtotal + deliveryFee) * 0.16);
  const total = subtotal + deliveryFee + vat;
  return { subtotal, deliveryFee, vat, total };
}

function getDeliveryFeeForZone(zone: string): number {
  const z = zone.toLowerCase();
  if (z.includes('kitengela') || z.includes('athi river')) return 300;
  if (z.includes('syokimau')) return 350;
  if (z.includes('nairobi') || z.includes('westlands')) return 500;
  return 600;
}

/** Return the next weekday YYYY-MM-DD (for pickup dates) */
export function nextBusinessDay(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
