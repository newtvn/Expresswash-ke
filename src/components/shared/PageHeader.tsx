import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({ title, description, children, className }: PageHeaderProps) => (
  <div className={cn('mb-5 flex min-w-0 flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between', className)}>
    <div className="min-w-0">
      <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</p>
      )}
    </div>
    {children && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">{children}</div>}
  </div>
);
