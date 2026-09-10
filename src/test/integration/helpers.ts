/**
 * Integration test helpers — uses a REAL Supabase connection.
 * No mocks, no jsdom. Hits the explicitly selected database.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const requiredEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Integration tests require runtime-only credentials.`);
  }
  return value;
};

const SUPABASE_URL = process.env.TEST_SUPABASE_URL?.trim() || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = requiredEnvironment('TEST_SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = requiredEnvironment('TEST_SUPABASE_SERVICE_ROLE_KEY');

const targetHost = new URL(SUPABASE_URL).hostname;
const isLocalTarget = targetHost === '127.0.0.1' || targetHost === 'localhost';

if (!isLocalTarget && process.env.ALLOW_PRODUCTION_INTEGRATION_TESTS !== 'true') {
  throw new Error(
    `Refusing integration tests against non-local Supabase host ${targetHost}. ` +
      'Set ALLOW_PRODUCTION_INTEGRATION_TESTS=true only for an explicitly authorized run.',
  );
}

export const TEST_ACCOUNTS = {
  customer: {
    email: requiredEnvironment('TEST_CUSTOMER_EMAIL'),
    password: requiredEnvironment('TEST_CUSTOMER_PASSWORD'),
    id: requiredEnvironment('TEST_CUSTOMER_ID'),
    name: 'Test Customer',
    role: 'customer' as const,
    zone: 'kitengela',
  },
  driver: {
    email: requiredEnvironment('TEST_DRIVER_EMAIL'),
    password: requiredEnvironment('TEST_DRIVER_PASSWORD'),
    id: requiredEnvironment('TEST_DRIVER_ID'),
    name: 'Test Driver',
    role: 'driver' as const,
    zone: 'kitengela',
  },
  admin: {
    email: requiredEnvironment('TEST_ADMIN_EMAIL'),
    password: requiredEnvironment('TEST_ADMIN_PASSWORD'),
    id: requiredEnvironment('TEST_ADMIN_ID'),
    name: 'Test Admin',
    role: 'admin' as const,
    zone: 'kitengela',
  },
} as const;

export const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Create an unauthenticated client against the same guarded test target. */
export function createTestClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

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
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw new Error(`Authentication failed after ${maxAttempts} attempts: ${lastError}`);
}

interface CleanupEntry {
  table: string;
  id: string;
  column?: string;
}

const cleanupQueue: CleanupEntry[] = [];

export function trackForCleanup(table: string, id: string, column = 'id') {
  cleanupQueue.push({ table, id, column });
}

/** Delete tracked fixtures in reverse dependency order. */
export async function runCleanup() {
  const reversed = [...cleanupQueue].reverse();
  for (const { table, id, column } of reversed) {
    await adminClient.from(table).delete().eq(column ?? 'id', id);
  }
  cleanupQueue.length = 0;
}

export const REALISTIC_ORDER_ITEMS = [
  {
    name: 'Living Room Persian Carpet',
    itemType: 'carpet',
    quantity: 1,
    lengthInches: 120,
    widthInches: 96,
    pricePerSqInch: 0.35,
    unitPrice: Math.round(120 * 96 * 0.35),
    totalPrice: Math.round(120 * 96 * 0.35),
  },
  {
    name: 'Bedroom Shaggy Rug',
    itemType: 'rug',
    quantity: 2,
    lengthInches: 72,
    widthInches: 48,
    pricePerSqInch: 0.40,
    unitPrice: Math.round(72 * 48 * 0.40),
    totalPrice: Math.round(72 * 48 * 0.40) * 2,
  },
  {
    name: 'Dining Chair Cushion Covers',
    itemType: 'chair',
    quantity: 6,
    lengthInches: 18,
    widthInches: 18,
    pricePerSqInch: 0.45,
    unitPrice: Math.round(18 * 18 * 0.45),
    totalPrice: Math.round(18 * 18 * 0.45) * 6,
  },
];

export function computeOrderTotals(items: typeof REALISTIC_ORDER_ITEMS, zone: string) {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const deliveryFee = getDeliveryFeeForZone(zone);
  const vat = Math.round((subtotal + deliveryFee) * 0.16);
  const total = subtotal + deliveryFee + vat;
  return { subtotal, deliveryFee, vat, total };
}

function getDeliveryFeeForZone(zone: string): number {
  const normalizedZone = zone.toLowerCase();
  if (normalizedZone.includes('kitengela') || normalizedZone.includes('athi river')) return 300;
  if (normalizedZone.includes('syokimau')) return 350;
  if (normalizedZone.includes('nairobi') || normalizedZone.includes('westlands')) return 500;
  return 600;
}

/** Return the next weekday as YYYY-MM-DD. */
export function nextBusinessDay(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}
