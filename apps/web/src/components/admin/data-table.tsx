'use client';

import type { Paginated } from '@toolshop/shared';
import { Button, Card, EmptyState, Input, Skeleton, Table, TBody, TD, TH, THead, TR, cn } from '@toolshop/ui';
import { Inbox, Search } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { faNumber } from '@/lib/format';

export interface Column<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  rowKey,
  empty = 'موردی یافت نشد',
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  rowKey: (row: T) => string;
  empty?: string;
  onRowClick?: (row: T) => void;
}) {
  if (loading && !rows) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }
  if (!rows || rows.length === 0) return <EmptyState icon={<Inbox />} title={empty} />;
  return (
    <Table>
      <THead>
        <TR className="hover:bg-transparent">
          {columns.map((column, index) => (
            <TH key={index} className={column.className}>
              {column.header}
            </TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {rows.map((row) => (
          <TR key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn(onRowClick && 'cursor-pointer')}>
            {columns.map((column, index) => (
              <TD key={index} className={column.className}>
                {column.cell(row)}
              </TD>
            ))}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export function Pager({ data, onPage }: { data: Paginated<unknown> | undefined; onPage: (page: number) => void }) {
  if (!data || data.totalPages <= 1) {
    return data ? <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">{faNumber(data.total)} مورد</p> : null;
  }
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
      <span>{faNumber(data.total)} مورد</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
          قبلی
        </Button>
        <span>
          صفحه {faNumber(data.page)} از {faNumber(data.totalPages)}
        </span>
        <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => onPage(data.page + 1)}>
          بعدی
        </Button>
      </div>
    </div>
  );
}

/** Debounced search input for list pages. */
export function SearchInput({ onSearch, placeholder = 'جستجو…', className }: { onSearch: (q: string) => void; placeholder?: string; className?: string }) {
  const [value, setValue] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => onSearch(value.trim()), 300);
    return () => clearTimeout(timer);
  }, [value, onSearch]);
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="h-9 ps-9" aria-label="جستجو" />
    </div>
  );
}

export function TableCard({ toolbar, children }: { toolbar?: ReactNode; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      {toolbar ? <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">{toolbar}</div> : null}
      {children}
    </Card>
  );
}
