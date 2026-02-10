import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportToCSV } from '@/utils/exportUtils';

interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  filename: string;
  columns?: { key: string; header: string }[];
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  filename,
  columns,
  label = 'Export CSV',
  variant = 'outline',
  size = 'sm',
}: ExportButtonProps<T>) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => exportToCSV(data, filename, columns)}
      disabled={data.length === 0}
    >
      <Download className="w-4 h-4 mr-2" />
      {label}
    </Button>
  );
}
