'use client';

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Input } from './Input';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface Props<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  searchPlaceholder?: string;
  searchKey?: keyof T;
  pageSize?: number;
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = 'Search',
  searchKey,
  pageSize = 10,
  toolbar,
  emptyTitle = 'No data yet',
  emptyDescription,
  rowClassName,
  onRowClick,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, value) => {
      if (!value) return true;
      const haystack = searchKey
        ? String((row.original as any)[searchKey] ?? '')
        : Object.values(row.original as any).map(String).join(' ');
      return haystack.toLowerCase().includes(String(value).toLowerCase());
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-xs">
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id} className="border-b border-neon/10 bg-base-deep/50">
                  {group.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sortDir = header.column.getIsSorted();
                    const ariaSort = sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : 'none';
                    const onActivate = header.column.getToggleSortingHandler();
                    return (
                      <th
                        key={header.id}
                        aria-sort={canSort ? ariaSort : undefined}
                        className={cn(
                          'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-lo select-none',
                          canSort && 'cursor-pointer',
                        )}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={onActivate}
                            className="inline-flex items-center gap-1 bg-transparent text-left font-medium uppercase tracking-wider text-ink-lo hover:text-ink-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span aria-hidden>{{ asc: '▲', desc: '▼' }[sortDir as string] ?? ''}</span>
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12">
                    <EmptyState title={emptyTitle} description={emptyDescription} />
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const interactive = !!onRowClick;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick?.(row.original)}
                      onKeyDown={
                        interactive
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onRowClick?.(row.original);
                              }
                            }
                          : undefined
                      }
                      role={interactive ? 'button' : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      className={cn('table-row transition', interactive && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40', rowClassName?.(row.original))}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 align-middle text-ink-hi">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-neon/10 px-4 py-3 text-xs text-ink-lo">
          <div>
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
