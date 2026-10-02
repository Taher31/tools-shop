import { Injectable } from '@nestjs/common';
import {
  DATA_ENTITY_KEYS,
  type DataEntityKey,
  type DataEntityView,
  hasPermission,
  type ImportReport,
  type ImportRowResult,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { type ColumnDef, type EntityHandler, type ParsedRow, viewOf } from './entity-handler';
import { BrandsHandler } from './handlers/brands.handler';
import { CategoriesHandler } from './handlers/categories.handler';
import { CouponsHandler } from './handlers/coupons.handler';
import { InventoryHandler } from './handlers/inventory.handler';
import { ProductsHandler } from './handlers/products.handler';
import { CustomersExportHandler, OrdersExportHandler } from './handlers/reports.handlers';
import { norm } from './value-parsers';
import { parseTable, TableError, type TableFormat, writeTable } from './tabular';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
/** Detailed rows kept in the response; failures are always kept. */
const MAX_RESULT_ROWS = 400;

@Injectable()
export class DataExchangeService {
  private readonly handlers: Map<DataEntityKey, EntityHandler>;

  constructor(
    products: ProductsHandler,
    categories: CategoriesHandler,
    brands: BrandsHandler,
    coupons: CouponsHandler,
    inventory: InventoryHandler,
    orders: OrdersExportHandler,
    customers: CustomersExportHandler,
    private readonly audit: AuditService,
  ) {
    const all: EntityHandler[] = [
      products,
      categories,
      brands,
      coupons,
      inventory,
      orders,
      customers,
    ];
    this.handlers = new Map(all.map((h) => [h.key, h]));
  }

  entities(actor: AuthContext): DataEntityView[] {
    return DATA_ENTITY_KEYS.map((key) => viewOf(this.handler(key), actor)).filter(
      (view) => view.canImport || view.canExport,
    );
  }

  private handler(key: string): EntityHandler {
    const handler = this.handlers.get(key as DataEntityKey);
    if (!handler) throw AppException.notFound('این بخش برای ورود و خروج داده پشتیبانی نمی‌شود.');
    return handler;
  }

  private require(handler: EntityHandler, kind: 'import' | 'export', actor: AuthContext): void {
    const needed = kind === 'import' ? handler.importPermissions : handler.exportPermissions;
    if (!needed) throw AppException.conflict('ورود داده از فایل برای این بخش پشتیبانی نمی‌شود.');
    if (!hasPermission(actor.permissions, needed)) {
      throw AppException.forbidden('برای این بخش دسترسی لازم را ندارید.');
    }
  }

  /** Sample workbook: header row, example rows and a guide sheet explaining each column. */
  async template(key: string, format: TableFormat, actor: AuthContext) {
    const handler = this.handler(key);
    this.require(handler, 'import', actor);
    const required = new Set(handler.columns.filter((c) => c.required).map((c) => c.header));
    const guide = {
      name: 'راهنما',
      headers: ['ستون', 'الزامی', 'توضیح', 'نمونه'],
      rows: [
        ...handler.columns.map((c) => [
          c.header,
          c.required ? 'بله' : 'خیر',
          c.description,
          c.example,
        ]),
        ...(handler.dynamicColumns ? [['ستون‌های اضافه', '', handler.dynamicColumns, '']] : []),
        ['', '', '', ''],
        [
          'نکات',
          '',
          'ردیف اول باید عنوان ستون‌ها باشد. مبلغ‌ها به تومان‌اند. خانه خالی در به‌روزرسانی یعنی «مقدار قبلی بدون تغییر». ابتدا گزینه «بررسی بدون ذخیره» را بزنید.',
          '',
        ],
      ],
    };
    const file = await writeTable(
      format,
      {
        name: 'نمونه',
        headers: handler.columns.map((c) => c.header),
        rows: handler.sample(),
        required,
        widths: handler.columns.map((c) => Math.min(40, Math.max(14, c.header.length + 8))),
      },
      format === 'xlsx' ? guide : undefined,
    );
    return { ...file, fileName: `${handler.key}-sample.${file.extension}` };
  }

  async export(
    key: string,
    query: Record<string, unknown>,
    format: TableFormat,
    actor: AuthContext,
  ) {
    const handler = this.handler(key);
    this.require(handler, 'export', actor);
    const table = await handler.export(query);
    const file = await writeTable(format, {
      name: handler.label.slice(0, 30),
      headers: table.headers,
      rows: table.rows,
      widths: table.headers.map((h) => Math.min(40, Math.max(12, h.length + 6))),
    });
    await this.audit.record({
      action: 'data.export',
      entityType: 'data',
      entityId: handler.key,
      summary: `خروجی ${handler.label} (${table.rows.length} ردیف)`,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    return { ...file, fileName: `${handler.key}-${stamp}.${file.extension}` };
  }

  async import(
    key: string,
    file: Express.Multer.File | undefined,
    dryRun: boolean,
    actor: AuthContext,
  ): Promise<ImportReport> {
    const handler = this.handler(key);
    this.require(handler, 'import', actor);
    if (!file?.buffer?.length)
      throw AppException.validation([{ path: 'file', message: 'فایلی انتخاب نشده است.' }]);
    if (file.size > MAX_FILE_BYTES)
      throw new AppException('PAYLOAD_TOO_LARGE', 'حجم فایل بیش از ۸ مگابایت است.');

    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    let table;
    try {
      table = await parseTable(fileName, file.buffer);
    } catch (error) {
      if (error instanceof TableError)
        throw AppException.validation([{ path: 'file', message: error.message }]);
      throw error;
    }

    const { mapping, unknown, missing } = this.mapColumns(
      handler.columns,
      table.headers,
      handler.dynamicColumns !== null,
    );
    if (missing.length > 0) {
      throw AppException.validation([
        {
          path: 'file',
          message: `ستون‌های الزامی در فایل نیست: ${missing.join('، ')}. فایل نمونه را دانلود کنید.`,
        },
      ]);
    }
    const rows: ParsedRow[] = table.rows.map((cells, index) => {
      const values: Record<string, string> = {};
      const extra: Record<string, string> = {};
      cells.forEach((cell, column) => {
        const header = table.headers[column] ?? '';
        const key = mapping.get(column);
        if (key) values[key] = cell;
        else if (header && handler.dynamicColumns !== null) extra[header] = cell;
      });
      for (const c of handler.columns) values[c.key] ??= '';
      return { row: table.numbers[index] ?? index + 2, values, extra };
    });

    const results = await handler.import(rows, { dryRun, actor });
    const count = (status: ImportRowResult['status']) =>
      results.filter((r) => r.status === status).length;
    const failed = results.filter((r) => r.status === 'error');
    const others = results.filter((r) => r.status !== 'error');
    const kept = [...failed, ...others.slice(0, Math.max(0, MAX_RESULT_ROWS - failed.length))].sort(
      (a, b) => a.row - b.row,
    );

    if (!dryRun) {
      await this.audit.record({
        action: 'data.import',
        entityType: 'data',
        entityId: handler.key,
        summary: `ورود ${handler.label} از فایل «${fileName.slice(0, 80)}»: ${count('create')} جدید، ${count('update')} به‌روزرسانی، ${failed.length} خطا`,
        after: { created: count('create'), updated: count('update'), failed: failed.length },
      });
    }
    return {
      entity: handler.key,
      dryRun,
      fileName,
      totalRows: rows.length,
      created: count('create'),
      updated: count('update'),
      unchanged: count('unchanged'),
      failed: failed.length,
      unknownColumns: unknown,
      missingColumns: missing,
      results: kept,
      truncated: kept.length < results.length,
    };
  }

  /** Header → column key, tolerant of digits, ZWNJ, Arabic letters and English aliases. */
  private mapColumns(columns: ColumnDef[], headers: string[], dynamic: boolean) {
    const byName = new Map<string, string>();
    for (const c of columns) {
      byName.set(norm(c.header), c.key);
      byName.set(norm(c.key), c.key);
      for (const alias of c.aliases ?? []) byName.set(norm(alias), c.key);
    }
    const mapping = new Map<number, string>();
    const unknown: string[] = [];
    const used = new Set<string>();
    headers.forEach((header, index) => {
      if (!header) return;
      const key = byName.get(norm(header));
      if (key && !used.has(key)) {
        mapping.set(index, key);
        used.add(key);
      } else if (!(dynamic && norm(header).startsWith(norm('ویژگی:')))) {
        unknown.push(header);
      }
    });
    const missing = columns.filter((c) => c.required && !used.has(c.key)).map((c) => c.header);
    return { mapping, unknown, missing };
  }
}
