import { supabase } from '@/lib/supabase';

interface PDFResult {
  url: string;
  path: string;
}

/**
 * Generate an invoice PDF via the generate-pdf Edge Function.
 * Returns a signed URL and storage path.
 */
export async function generateInvoicePDF(invoiceId: string): Promise<PDFResult> {
  const { data, error } = await supabase.functions.invoke('generate-pdf', {
    body: { type: 'invoice', id: invoiceId },
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to generate invoice PDF');
  }

  return { url: data.url, path: data.path };
}

/**
 * Generate a receipt PDF via the generate-pdf Edge Function.
 * Returns a signed URL and storage path.
 */
export async function generateReceiptPDF(paymentId: string): Promise<PDFResult> {
  const { data, error } = await supabase.functions.invoke('generate-pdf', {
    body: { type: 'receipt', id: paymentId },
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to generate receipt PDF');
  }

  return { url: data.url, path: data.path };
}

/**
 * Get a fresh signed URL for an already-generated PDF in storage.
 */
export async function getExistingPDFUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    throw new Error('Failed to get PDF download URL');
  }

  return data.signedUrl;
}
