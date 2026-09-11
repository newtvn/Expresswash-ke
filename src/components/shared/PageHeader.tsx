import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({ title, description, children, className }: PageHeaderProps) => (
  <div className={cn('mb-5 flex min-w-0 flex-col gap-4 sm:mb-6 lg:flex-row lg:items-center lg:justify-between', className)}>
    <div className="min-w-0">
      <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</p>
      )}
    </div>
    {children && (
      <div className="flex w-full flex-col gap-2 [&>*]:w-full lg:w-auto lg:flex-row lg:flex-wrap lg:items-center lg:justify-end lg:gap-3 lg:[&>*]:w-auto">
        {children}
      </div>
    )}
  </div>
);
