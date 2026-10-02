'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@toolshop/ui';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { DropdownMenuTrigger } from '@toolshop/ui';
import type { DataEntityKey } from '@toolshop/shared';
import { usePermissions } from '@/hooks/use-permissions';
import { toQueryString } from '@/lib/api/client';

type Params = Record<string, string | number | boolean | undefined>;

/** Export of exactly what the list shows now (current search, filters and date range). */
export function ExportButton({ entity, params }: { entity: DataEntityKey; params: Params }) {
  const { can } = usePermissions();
  if (!can('data.export')) return null;
  const { page: _page, pageSize: _pageSize, sort: _sort, ...filters } = params;
  const href = (format: 'xlsx' | 'csv') =>
    `/api/v1/admin/data/${entity}/export${toQueryString({ ...filters, format })}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-9">
          <Download /> خروجی
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>خروجی با فیلترهای فعلی</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href={href('xlsx')} download>
            <FileSpreadsheet className="size-4" /> Excel (xlsx)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href('csv')} download>
            <FileText className="size-4" /> CSV
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
