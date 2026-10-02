import type {
  DataColumnView,
  DataEntityKey,
  DataEntityView,
  ImportRowResult,
  Permission,
} from '@toolshop/shared';
import type { AuthContext } from '../auth/auth-context';

export interface ColumnDef extends DataColumnView {
  key: string;
  /** Other accepted spellings of the header (English keys, older names). */
  aliases?: string[];
}

export interface ParsedRow {
  /** Spreadsheet row number (header = 1). */
  row: number;
  /** Values by column key; empty cells are ''. */
  values: Record<string, string>;
  /** Columns the entity does not define, by original header (e.g. "ویژگی: توان"). */
  extra: Record<string, string>;
}

export interface ImportContext {
  dryRun: boolean;
  actor: AuthContext;
}

export interface ExportTable {
  headers: string[];
  rows: (string | number | null)[][];
}

export interface EntityHandler {
  key: DataEntityKey;
  label: string;
  description: string;
  columns: ColumnDef[];
  dynamicColumns: string | null;
  importPermissions: Permission[] | null;
  exportPermissions: Permission[];
  /** Example rows in `columns` order (shown in the downloadable sample file). */
  sample(): string[][];
  /** Rows to download; `query` is the raw list query (filters, search, dates). */
  export(query: Record<string, unknown>): Promise<ExportTable>;
  import(rows: ParsedRow[], context: ImportContext): Promise<ImportRowResult[]>;
}

export function viewOf(handler: EntityHandler, actor: AuthContext): DataEntityView {
  const granted = new Set(actor.permissions);
  const has = (list: Permission[] | null) => list !== null && list.every((p) => granted.has(p));
  return {
    key: handler.key,
    label: handler.label,
    description: handler.description,
    canImport: has(handler.importPermissions),
    canExport: has(handler.exportPermissions),
    columns: handler.columns.map(({ header, required, description, example }) => ({
      header,
      required,
      description,
      example,
    })),
    dynamicColumns: handler.dynamicColumns,
  };
}

export const rowResult = (
  row: number,
  status: ImportRowResult['status'],
  label: string,
  messages: string[] = [],
): ImportRowResult => ({ row, status, label, messages });

/** Zod issues → short Persian messages with the offending column. */
export function issueMessages(
  issues: { path: PropertyKey[]; message: string }[],
  columnOf: (path: string) => string | null = () => null,
): string[] {
  return issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    const column = columnOf(path);
    return column ? `${column}: ${issue.message}` : issue.message;
  });
}
