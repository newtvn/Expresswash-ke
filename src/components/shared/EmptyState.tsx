import { LucideIcon, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export const EmptyState = ({
  icon: Icon = Inbox,
  title,
  description,
  children,
  className,
}: EmptyStateProps) => (
  <div className={cn('text-center py-16', className)}>
    <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
      <Icon className="w-8 h-8 text-muted-foreground" />
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
    {description && (
      <p className="text-muted-foreground max-w-sm mx-auto">{description}</p>
    )}
    {children && <div className="mt-4">{children}</div>}
  </div>
);
