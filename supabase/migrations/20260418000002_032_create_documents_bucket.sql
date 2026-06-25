-- ============================================================
-- Create documents storage bucket for PDF generation
-- Problem: generate-pdf edge function uploads to 'documents' bucket
--          but the bucket was never created (was a manual setup step)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Service role can insert documents (edge functions use service role)
CREATE POLICY "service_role_insert_documents" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'documents');

-- Service role can update documents
CREATE POLICY "service_role_update_documents" ON storage.objects
  FOR UPDATE TO service_role
  USING (bucket_id = 'documents');

-- Authenticated users can read documents (for downloading invoices)
CREATE POLICY "authenticated_read_documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');
