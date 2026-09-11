import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginatorProps {
  /** 0-indexed current page. */
  page: number;
  totalPages: number;
  /** Total number of items across all pages (for the "Showing X–Y of Z" label). */
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const range = (start: number, end: number): number[] =>
  Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);

// 1-indexed page tokens with ellipsis markers around the current page.
function pageItems(current: number, totalPages: number, siblings = 1): (number | 'ellipsis')[] {
  const slots = siblings * 2 + 5; // first, last, current, two ellipsis slots
  if (totalPages <= slots) return range(1, totalPages);

  const left = Math.max(current - siblings, 1);
  const right = Math.min(current + siblings, totalPages);
  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    return [...range(1, 3 + siblings * 2), 'ellipsis', totalPages];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    return [1, 'ellipsis', ...range(totalPages - (2 + siblings * 2), totalPages)];
  }
  return [1, 'ellipsis', ...range(left, right), 'ellipsis', totalPages];
}

/**
 * Shared, DRY paginator: numbered pages with ellipsis, Previous/Next, and a
 * "Showing X–Y of Z results" label. Pages are 0-indexed to match server-side
 * `.range()` fetchers. Renders nothing when there's a single page.
 */
export const Paginator = ({ page, totalPages, total, pageSize, onPageChange, className }: PaginatorProps) => {
  if (totalPages <= 1) return null;

  const current = page + 1; // 1-indexed for display
  const items = pageItems(current, totalPages);
  const shownFrom = total === 0 ? 0 : page * pageSize + 1;
  const shownTo = Math.min(total, (page + 1) * pageSize);
  const go = (oneIndexed: number) => onPageChange(oneIndexed - 1);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-col items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 shadow-sm sm:flex-row',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground sm:text-sm">
        Showing {shownFrom.toLocaleString()}–{shownTo.toLocaleString()} of {total.toLocaleString()} results
      </p>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={current <= 1}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>

        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} aria-hidden className="px-2 text-sm text-muted-foreground">…</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => go(item)}
              aria-current={item === current ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-sm font-medium transition-colors',
                item === current ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent',
              )}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => go(current + 1)}
          disabled={current >= totalPages}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
};
