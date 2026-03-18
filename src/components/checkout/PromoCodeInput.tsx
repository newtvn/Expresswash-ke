import { useState } from 'react';
import { validatePromoCode } from '@/services/promotionService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Tag } from 'lucide-react';

interface PromoCodeInputProps {
  onApply: (code: string | null, promotionId: string | null) => void;
  /** Current order subtotal for min_order_amount validation */
  subtotal?: number;
}

export function PromoCodeInput({ onApply, subtotal }: PromoCodeInputProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; message: string } | null>(null);

  async function handleApply() {
    if (!code.trim()) return;

    setLoading(true);
    try {
      const validation = await validatePromoCode(code, subtotal);
      setResult(validation);

      if (validation.valid && validation.promotion) {
        onApply(code.toUpperCase().trim(), validation.promotion.id);
      } else {
        onApply(null, null);
      }
    } catch {
      setResult({ valid: false, message: 'Failed to validate code' });
      onApply(null, null);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setCode('');
    setResult(null);
    onApply(null, null);
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-1.5">
        <Tag className="h-4 w-4" /> Promo Code
      </label>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (result) setResult(null);
          }}
          placeholder="Enter code"
          className="font-mono uppercase"
          disabled={result?.valid}
        />
        {result?.valid ? (
          <Button variant="outline" onClick={handleClear} size="sm">
            Clear
          </Button>
        ) : (
          <Button onClick={handleApply} disabled={loading || !code.trim()} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
          </Button>
        )}
      </div>
      {result && (
        <p className={`text-sm flex items-center gap-1 ${result.valid ? 'text-green-600' : 'text-red-500'}`}>
          {result.valid ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {result.message}
        </p>
      )}
    </div>
  );
}
