import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateReceiptPDF, getExistingPDFUrl } from '@/services/pdfService';

interface ReceiptDownloadButtonProps {
  paymentId: string;
  receiptUrl?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const ReceiptDownloadButton = ({
  paymentId,
  receiptUrl,
  variant = 'outline',
  size = 'sm',
}: ReceiptDownloadButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      let url: string;

      if (receiptUrl) {
        url = await getExistingPDFUrl(receiptUrl);
      } else {
        const result = await generateReceiptPDF(paymentId);
        url = result.url;
      }

      window.open(url, '_blank');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download receipt PDF';
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
      {loading ? 'Generating...' : 'Receipt'}
    </Button>
  );
};
