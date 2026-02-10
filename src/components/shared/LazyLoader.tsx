import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyLoaderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const DefaultFallback = () => (
  <div className="p-6 space-y-4 animate-pulse">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-4 w-96" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
    <Skeleton className="h-64 mt-6 rounded-xl" />
  </div>
);

export const LazyLoader = ({ children, fallback }: LazyLoaderProps) => (
  <Suspense fallback={fallback || <DefaultFallback />}>
    {children}
  </Suspense>
);
