/**
 * Supabase Edge Function: Generate PDF
 * Creates invoice or receipt PDFs using pdf-lib.
 *
 * Endpoint: POST /functions/v1/generate-pdf
 * Body: { "type": "invoice" | "receipt", "id": "<uuid>" }
 *
 * Returns: { "url": "<signed-url>", "path": "<storage-path>" }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import { logger } from '../_shared/logger.ts';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../_shared/rateLimiter.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const STORAGE_BUCKET = 'documents';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Company details (hardcoded for now, can move to system_config later)
const COMPANY = {
  name: 'ExpressWash Kenya',
  address: 'Kitengela, Kajiado County, Kenya',
  phone: '+254 700 000 000',
  email: 'info@expresswash.co.ke',
  website: 'www.expresswash.co.ke',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResult = checkRateLimit(req, RATE_LIMITS.API);
  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit exceeded for generate-pdf');
    return createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  try {
    const { type, id } = await req.json();

    if (!type || !id) {
      return jsonResponse({ error: 'Missing "type" and "id" in request body' }, 400);
    }

    if (type !== 'invoice' && type !== 'receipt') {
      return jsonResponse({ error: 'Type must be "invoice" or "receipt"' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let pdfBytes: Uint8Array;
    let storagePath: string;

    if (type === 'invoice') {
      const result = await generateInvoicePDF(supabase, id);
      pdfBytes = result.bytes;
      storagePath = result.path;
    } else {
      const result = await generateReceiptPDF(supabase, id);
      pdfBytes = result.bytes;
      storagePath = result.path;
    }

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      logger.error('Failed to upload PDF to storage', { error: uploadError.message });
      return jsonResponse({ error: 'Failed to store PDF' }, 500);
    }

    // Get signed URL (valid for 1 hour)
    const { data: signedData } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    const signedUrl = signedData?.signedUrl ?? '';

    // Update the record with storage path
    if (type === 'invoice') {
      await supabase
        .from('invoices')
        .update({ pdf_url: storagePath })
        .eq('id', id);
    } else {
      await supabase
        .from('payments')
        .update({ receipt_url: storagePath })
        .eq('id', id);
    }

    logger.info(`PDF generated: ${type}`, { storagePath });
    return jsonResponse({ url: signedUrl, path: storagePath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('generate-pdf error', { error: message });
    return jsonResponse({ error: message }, 500);
  }
});

// ============================================================
// INVOICE PDF GENERATION
// ============================================================

async function generateInvoicePDF(
  supabase: ReturnType<typeof createClient>,
  invoiceId: string,
): Promise<{ bytes: Uint8Array; path: string }> {
  // Fetch invoice
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  // Fetch invoice items
  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId);

  // Fetch customer phone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', invoice.customer_id)
    .single();

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();

  const darkGray = rgb(0.2, 0.2, 0.2);
  const gray = rgb(0.5, 0.5, 0.5);
  const primary = rgb(0.09, 0.45, 0.82);
  const lightBg = rgb(0.96, 0.96, 0.98);

  let y = height - 50;

  // Header
  page.drawText(COMPANY.name, { x: 50, y, font: fontBold, size: 20, color: primary });
  y -= 18;
  page.drawText(COMPANY.address, { x: 50, y, font, size: 9, color: gray });
  y -= 13;
  page.drawText(`${COMPANY.phone} | ${COMPANY.email}`, { x: 50, y, font, size: 9, color: gray });

  // Invoice title
  page.drawText('INVOICE', { x: 420, y: height - 50, font: fontBold, size: 24, color: darkGray });
  page.drawText(invoice.invoice_number ?? '', { x: 420, y: height - 70, font, size: 11, color: gray });

  // Status badge
  const statusText = (invoice.status ?? 'draft').toUpperCase();
  page.drawText(statusText, { x: 420, y: height - 88, font: fontBold, size: 10, color: invoice.status === 'paid' ? rgb(0.1, 0.6, 0.2) : primary });

  y -= 30;

  // Divider
  page.drawRectangle({ x: 50, y, width: 495, height: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 25;

  // Bill To
  page.drawText('Bill To:', { x: 50, y, font: fontBold, size: 10, color: darkGray });
  y -= 15;
  page.drawText(invoice.customer_name ?? '', { x: 50, y, font, size: 10, color: darkGray });
  y -= 13;
  page.drawText(invoice.customer_email ?? '', { x: 50, y, font, size: 9, color: gray });
  if (profile?.phone) {
    y -= 13;
    page.drawText(profile.phone, { x: 50, y, font, size: 9, color: gray });
  }

  // Invoice details (right side)
  const detailsY = y + 41;
  page.drawText('Order #:', { x: 350, y: detailsY, font, size: 9, color: gray });
  page.drawText(invoice.order_number ?? '', { x: 420, y: detailsY, font, size: 9, color: darkGray });
  page.drawText('Issued:', { x: 350, y: detailsY - 14, font, size: 9, color: gray });
  page.drawText(formatDate(invoice.issued_at), { x: 420, y: detailsY - 14, font, size: 9, color: darkGray });
  page.drawText('Due:', { x: 350, y: detailsY - 28, font, size: 9, color: gray });
  page.drawText(formatDate(invoice.due_at), { x: 420, y: detailsY - 28, font, size: 9, color: darkGray });
  if (invoice.paid_at) {
    page.drawText('Paid:', { x: 350, y: detailsY - 42, font, size: 9, color: gray });
    page.drawText(formatDate(invoice.paid_at), { x: 420, y: detailsY - 42, font, size: 9, color: rgb(0.1, 0.6, 0.2) });
  }

  y -= 40;

  // Items table header
  y -= 10;
  page.drawRectangle({ x: 50, y: y - 5, width: 495, height: 22, color: lightBg });
  page.drawText('Description', { x: 55, y, font: fontBold, size: 9, color: darkGray });
  page.drawText('Qty', { x: 330, y, font: fontBold, size: 9, color: darkGray });
  page.drawText('Unit Price', { x: 380, y, font: fontBold, size: 9, color: darkGray });
  page.drawText('Total', { x: 480, y, font: fontBold, size: 9, color: darkGray });
  y -= 22;

  // Items rows
  const lineItems = items ?? [];
  for (const item of lineItems) {
    page.drawText(item.description ?? '', { x: 55, y, font, size: 9, color: darkGray });
    page.drawText(String(item.quantity ?? 1), { x: 335, y, font, size: 9, color: darkGray });
    page.drawText(`KES ${formatNumber(item.unit_price)}`, { x: 380, y, font, size: 9, color: darkGray });
    page.drawText(`KES ${formatNumber(item.total)}`, { x: 470, y, font, size: 9, color: darkGray });
    y -= 18;
  }

  // Divider
  y -= 5;
  page.drawRectangle({ x: 350, y, width: 195, height: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 18;

  // Totals
  page.drawText('Subtotal:', { x: 370, y, font, size: 9, color: gray });
  page.drawText(`KES ${formatNumber(invoice.subtotal)}`, { x: 470, y, font, size: 9, color: darkGray });
  y -= 15;

  if (invoice.discount && invoice.discount > 0) {
    page.drawText('Discount:', { x: 370, y, font, size: 9, color: gray });
    page.drawText(`-KES ${formatNumber(invoice.discount)}`, { x: 470, y, font, size: 9, color: rgb(0.8, 0.2, 0.2) });
    y -= 15;
  }

  page.drawText(`VAT (${((invoice.vat_rate ?? 0.16) * 100).toFixed(0)}%):`, { x: 370, y, font, size: 9, color: gray });
  page.drawText(`KES ${formatNumber(invoice.vat_amount)}`, { x: 470, y, font, size: 9, color: darkGray });
  y -= 20;

  page.drawRectangle({ x: 350, y: y + 2, width: 195, height: 1, color: darkGray });
  page.drawText('Total:', { x: 370, y: y - 12, font: fontBold, size: 12, color: darkGray });
  page.drawText(`KES ${formatNumber(invoice.total)}`, { x: 460, y: y - 12, font: fontBold, size: 12, color: primary });

  // Footer
  page.drawText('Thank you for choosing ExpressWash!', { x: 50, y: 60, font, size: 9, color: gray });
  page.drawText(COMPANY.website, { x: 50, y: 45, font, size: 8, color: primary });

  const pdfBytes = await doc.save();
  const path = `invoices/${invoice.invoice_number ?? invoiceId}.pdf`;

  return { bytes: pdfBytes, path };
}

// ============================================================
// RECEIPT PDF GENERATION
// ============================================================

async function generateReceiptPDF(
  supabase: ReturnType<typeof createClient>,
  paymentId: string,
): Promise<{ bytes: Uint8Array; path: string }> {
  // Fetch payment
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (error || !payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }

  // Fetch related invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', payment.invoice_id)
    .single();

  if (!invoice) {
    throw new Error(`Invoice not found for payment: ${paymentId}`);
  }

  // Fetch customer phone
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', invoice.customer_id)
    .single();

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 600]); // Shorter page for receipt
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();

  const darkGray = rgb(0.2, 0.2, 0.2);
  const gray = rgb(0.5, 0.5, 0.5);
  const green = rgb(0.1, 0.6, 0.2);
  const lightBg = rgb(0.96, 0.98, 0.96);

  let y = height - 50;

  // Header
  page.drawText(COMPANY.name, { x: 50, y, font: fontBold, size: 18, color: green });
  y -= 16;
  page.drawText(COMPANY.address, { x: 50, y, font, size: 9, color: gray });
  y -= 13;
  page.drawText(`${COMPANY.phone} | ${COMPANY.email}`, { x: 50, y, font, size: 9, color: gray });

  // Title
  page.drawText('PAYMENT RECEIPT', { x: 380, y: height - 50, font: fontBold, size: 18, color: darkGray });
  y -= 30;

  // Divider
  page.drawRectangle({ x: 50, y, width: 495, height: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 25;

  // Payment details
  const methodLabel: Record<string, string> = {
    mpesa: 'M-Pesa',
    cash: 'Cash',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
  };

  const details = [
    ['Invoice #', invoice.invoice_number ?? ''],
    ['Order #', invoice.order_number ?? ''],
    ['Customer', invoice.customer_name ?? ''],
    ['Email', invoice.customer_email ?? ''],
    ['Phone', profile?.phone ?? ''],
    ['Payment Date', formatDate(payment.created_at)],
    ['Payment Method', methodLabel[payment.method] ?? payment.method],
    ['Reference', payment.reference ?? ''],
  ];

  if (payment.mpesa_receipt_number) {
    details.push(['M-Pesa Receipt', payment.mpesa_receipt_number]);
  }

  for (const [label, value] of details) {
    if (!value) continue;
    page.drawText(`${label}:`, { x: 55, y, font, size: 9, color: gray });
    page.drawText(value, { x: 180, y, font, size: 9, color: darkGray });
    y -= 16;
  }

  y -= 10;
  page.drawRectangle({ x: 50, y, width: 495, height: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 25;

  // Amount box
  page.drawRectangle({ x: 50, y: y - 15, width: 495, height: 50, color: lightBg, borderColor: green, borderWidth: 1 });
  page.drawText('Amount Paid:', { x: 65, y: y + 5, font, size: 11, color: gray });
  page.drawText(`KES ${formatNumber(payment.amount)}`, { x: 65, y: y - 12, font: fontBold, size: 18, color: green });
  page.drawText('PAID', { x: 480, y: y - 5, font: fontBold, size: 14, color: green });

  y -= 50;

  if (payment.notes) {
    y -= 15;
    page.drawText('Notes:', { x: 55, y, font, size: 9, color: gray });
    y -= 14;
    page.drawText(payment.notes, { x: 55, y, font, size: 9, color: darkGray });
  }

  // Footer
  page.drawText('Thank you for your payment!', { x: 50, y: 55, font, size: 9, color: gray });
  page.drawText(COMPANY.website, { x: 50, y: 40, font, size: 8, color: green });

  const pdfBytes = await doc.save();
  const path = `receipts/${payment.invoice_number ?? paymentId}.pdf`;

  return { bytes: pdfBytes, path };
}

// ============================================================
// HELPERS
// ============================================================

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '--';
  try {
    return new Date(isoDate).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDate.split('T')[0] ?? '--';
  }
}

function formatNumber(num: number | null): string {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
