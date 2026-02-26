import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateInvoicePDF, getExistingPDFUrl } from '@/services/pdfService';

interface InvoiceDownloadButtonProps {
  invoiceId: string;
  pdfUrl?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const InvoiceDownloadButton = ({
  invoiceId,
  pdfUrl,
  variant = 'outline',
  size = 'sm',
}: InvoiceDownloadButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      let url: string;

      if (pdfUrl) {
        // PDF already generated — get a fresh signed URL
        url = await getExistingPDFUrl(pdfUrl);
      } else {
        // Generate PDF first
        const result = await generateInvoicePDF(invoiceId);
        url = result.url;
      }

      window.open(url, '_blank');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download invoice PDF';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleDownload} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-1" />
      ) : (
        <Download className="h-4 w-4 mr-1" />
      )}
      {loading ? 'Generating...' : 'Download'}
    </Button>
  );
};
