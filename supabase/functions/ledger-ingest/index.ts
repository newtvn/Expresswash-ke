/**
 * Supabase Edge Function: Ledger Ingest
 *
 * Inbound endpoint for the multi-app accounting hub. External systems
 * (starting with Goalhub) POST normalized financial events here; each is
 * turned into an idempotent, balanced double-entry journal entry in the
 * Expresswash ledger via the post_ingested_journal_entry RPC.
 *
 * Endpoint: POST /functions/v1/ledger-ingest
 * Auth:     Authorization: Bearer <LEDGER_INGEST_SECRET>
 *           (a dedicated shared secret — NOT the Supabase service-role key.
 *            Source apps only ever hold this secret.)
 *
 * Body (JSON):
 * {
 *   "source_system": "goalhub",          // required
 *   "event_type": "booking_payment",     // required, must have a mapping
 *   "external_id": "<uuid-of-source-record>", // required, idempotency key
 *   "amount": 2000,                       // required, > 0
 *   "business": "goalhub",               // optional, defaults to source_system
 *   "occurred_at": "2026-08-18T09:30:00Z", // optional, defaults to now
 *   "provider": "mpesa",                 // optional, informational
 *   "currency": "KES",                   // optional, defaults to KES
 *   "memo": "Booking #1234",             // optional
 *   "metadata": { ... },                 // optional, stored on the line
 *   "idempotency_key": "...",            // optional
 *   "debit_account_key": "...",          // optional mapping override
 *   "credit_account_key": "..."          // optional mapping override
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from '../_shared/logger.ts';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../_shared/rateLimiter.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ingestSecret = Deno.env.get('LEDGER_INGEST_SECRET') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IngestEvent {
  source_system?: unknown;
  event_type?: unknown;
  external_id?: unknown;
  amount?: unknown;
  business?: unknown;
  occurred_at?: unknown;
  provider?: unknown;
  currency?: unknown;
  memo?: unknown;
  metadata?: unknown;
  idempotency_key?: unknown;
  debit_account_key?: unknown;
  credit_account_key?: unknown;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function asDate(value: unknown): string | null {
  const str = asString(value);
  if (!str) return null;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  // RPC expects a DATE; send YYYY-MM-DD.
  return parsed.toISOString().slice(0, 10);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  // --- Auth: dedicated ingest secret ---------------------------------------
  if (!ingestSecret) {
    logger.error('LEDGER_INGEST_SECRET not configured');
    return jsonResponse({ success: false, error: 'Ingest not configured' }, 503);
  }
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${ingestSecret}`) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  // --- Rate limit ----------------------------------------------------------
  const rateLimitResult = checkRateLimit(req, RATE_LIMITS.API);
  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit exceeded for ledger-ingest');
    return createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  // --- Parse + validate ----------------------------------------------------
  let event: IngestEvent;
  try {
    event = (await req.json()) as IngestEvent;
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const sourceSystem = asString(event.source_system);
  const eventType = asString(event.event_type);
  const externalId = asString(event.external_id);
  const amount = Number(event.amount);

  if (!sourceSystem || !eventType || !externalId) {
    return jsonResponse(
      { success: false, error: 'source_system, event_type and external_id are required' },
      400,
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse({ success: false, error: 'amount must be a number greater than zero' }, 400);
  }

  const metadata =
    event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
      ? (event.metadata as Record<string, unknown>)
      : {};

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.rpc('post_ingested_journal_entry', {
      p_source_system: sourceSystem,
      p_event_type: eventType,
      p_external_id: externalId,
      p_amount: amount,
      p_business: asString(event.business),
      p_entry_date: asDate(event.occurred_at),
      p_provider: asString(event.provider),
      p_currency: asString(event.currency) ?? 'KES',
      p_memo: asString(event.memo),
      p_metadata: metadata,
      p_idempotency_key: asString(event.idempotency_key),
      p_debit_account_key: asString(event.debit_account_key),
      p_credit_account_key: asString(event.credit_account_key),
    });

    if (error) {
      logger.error('Ledger ingest RPC error', {
        error: error.message,
        sourceSystem,
        eventType,
        externalId,
      });
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    const result = data as { success?: boolean; idempotent?: boolean; journal_entry_id?: string; error?: string } | null;

    if (!result?.success) {
      // Mapping/validation failures are the caller's fault -> 422 (do not retry as-is).
      logger.warn('Ledger ingest rejected', {
        error: result?.error,
        sourceSystem,
        eventType,
        externalId,
      });
      return jsonResponse({ success: false, error: result?.error ?? 'Ingest rejected' }, 422);
    }

    logger.info('Ledger ingest posted', {
      sourceSystem,
      eventType,
      externalId,
      idempotent: result.idempotent,
      journalEntryId: result.journal_entry_id,
    });

    return jsonResponse({
      success: true,
      idempotent: Boolean(result.idempotent),
      journal_entry_id: result.journal_entry_id,
    });
  } catch (err) {
    logger.error('Ledger ingest processing error', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return jsonResponse({ success: false, error: 'Internal error' }, 500);
  }
});
