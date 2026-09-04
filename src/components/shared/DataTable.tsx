import { useState, useMemo } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronUp, ChevronDown, Search, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (item: T) => void;
  className?: string;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = 'Search...',
  pageSize = 10,
  onRowClick,
  className,
  emptyMessage = 'No data found',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const processed = useMemo(() => {
    let result = [...data];

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter((item) =>
        Object.values(item).some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(lower)
        )
      );
    }

    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, search, sortKey, sortDir]);

  const paged = processed.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(processed.length / pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {searchable && (
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
      )}

      <div className="data-table-desktop rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((col, columnIndex) => (
                <TableHead
                  key={`${col.key}-${col.header}-${columnIndex}`}
                  className={cn(
                    col.sortable && 'cursor-pointer select-none hover:bg-muted/80',
                    col.className
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((item, i) => (
                <TableRow
                  key={i}
                  className={cn(
                    onRowClick && 'cursor-pointer hover:bg-muted/50',
                    'transition-colors'
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col, columnIndex) => (
                    <TableCell key={`${col.key}-${col.header}-${columnIndex}`} className={col.className}>
                      {col.render
                        ? col.render(item)
                        : String(item[col.key] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="data-table-mobile space-y-3">
        {paged.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          paged.map((item, rowIndex) => (
            <div
              key={rowIndex}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn(
                'min-w-0 space-y-3 rounded-xl border bg-card p-4 text-sm shadow-sm',
                onRowClick && 'cursor-pointer outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              )}
              onClick={() => onRowClick?.(item)}
              onKeyDown={(event) => {
                if (onRowClick && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  onRowClick(item);
                }
              }}
            >
              {columns.map((col, columnIndex) => (
                <div
                  key={`${col.key}-${col.header}-${columnIndex}`}
                  className={cn(
                    col.header
                      ? 'grid min-w-0 grid-cols-[minmax(5.5rem,0.75fr)_minmax(0,1.25fr)] items-start gap-3'
                      : 'flex min-w-0 justify-end border-t pt-3',
                    col.className
                  )}
                >
                  {col.header && <span className="text-xs font-medium text-muted-foreground">{col.header}</span>}
                  <div className="min-w-0 break-words text-right">
                    {col.render ? col.render(item) : String(item[col.key] ?? '')}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1}-
            {Math.min((page + 1) * pageSize, processed.length)} of{' '}
            {processed.length}
          </p>
          <div className="flex items-center justify-between gap-1 sm:justify-end">
            <Button
              variant="outline"
              size="icon"
              className="hidden h-8 w-8 sm:inline-flex"
              disabled={page === 0}
              onClick={() => setPage(0)}
              aria-label="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="px-1 text-sm text-muted-foreground sm:px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden h-8 w-8 sm:inline-flex"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(totalPages - 1)}
              aria-label="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
