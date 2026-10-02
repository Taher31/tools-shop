import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { InventoryService } from '../../inventory/inventory.service';
import {
  type ColumnDef,
  type EntityHandler,
  type ExportTable,
  type ImportContext,
  type ParsedRow,
  rowResult,
} from '../entity-handler';
import { norm, parseIntStrict } from '../value-parsers';

const COLUMNS: ColumnDef[] = [
  {
    key: 'sku',
    header: 'SKU',
    required: true,
    aliases: ['sku', 'کد کالا'],
    description: 'SKU تنوع محصول (انگلیسی؛ حروف بزرگ و کوچک فرقی ندارد)',
    example: 'BSH-GSB-18V',
  },
  {
    key: 'warehouse',
    header: 'کد انبار',
    required: false,
    aliases: ['warehouse', 'انبار'],
    description: 'کد یا نام انبار؛ خالی = انبار پیش‌فرض',
    example: 'MAIN',
  },
  {
    key: 'quantity',
    header: 'موجودی',
    required: true,
    aliases: ['quantity', 'qty', 'stock'],
    description: 'موجودی نهایی (شمارش‌شده) در این انبار؛ جایگزین مقدار فعلی می‌شود',
    example: '25',
  },
  {
    key: 'note',
    header: 'یادداشت',
    required: false,
    aliases: ['note'],
    description: 'در سند انبار ثبت می‌شود',
    example: 'شمارش پایان ماه',
  },
];

@Injectable()
export class InventoryHandler implements EntityHandler {
  readonly key = 'inventory' as const;
  readonly label = 'موجودی انبار';
  readonly description =
    'تنظیم موجودی هر SKU در هر انبار (شمارش نهایی). هر تغییر در اسناد انبار ثبت می‌شود.';
  readonly columns = COLUMNS;
  readonly dynamicColumns = null;
  readonly importPermissions = ['inventory.update'] as const as never;
  readonly exportPermissions = ['inventory.read'] as const as never;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  sample(): string[][] {
    return [
      ['BSH-GSB-18V', 'MAIN', '25', 'شمارش پایان ماه'],
      ['MKT-HP1630', '', '8', ''],
    ];
  }

  async export(): Promise<ExportTable> {
    const levels = await this.prisma.inventoryLevel.findMany({
      where: { variant: { deletedAt: null, product: { deletedAt: null } } },
      include: { variant: { select: { sku: true } }, warehouse: { select: { code: true } } },
      orderBy: [{ variant: { sku: 'asc' } }, { warehouse: { code: 'asc' } }],
    });
    return {
      headers: COLUMNS.map((c) => c.header),
      rows: levels.map((l) => [l.variant.sku, l.warehouse.code, l.onHand, '']),
    };
  }

  async import(rows: ParsedRow[], { dryRun, actor }: ImportContext) {
    const warehouses = await this.prisma.warehouse.findMany({ where: { isActive: true } });
    const byKey = new Map<string, (typeof warehouses)[number]>();
    for (const w of warehouses) {
      byKey.set(norm(w.code), w);
      byKey.set(norm(w.name), w);
    }
    const fallback = warehouses.find((w) => w.isDefault) ?? warehouses[0];
    const variants = await this.prisma.productVariant.findMany({
      where: {
        sku: { in: rows.map((r) => (r.values['sku'] ?? '').toUpperCase()).filter(Boolean) },
        deletedAt: null,
      },
      select: { id: true, sku: true },
    });
    const bySku = new Map(variants.map((v) => [v.sku.toUpperCase(), v.id]));
    const seen = new Set<string>();
    const results = [];
    for (const row of rows) {
      const v = row.values;
      const sku = (v['sku'] ?? '').toUpperCase();
      const label = sku || `ردیف ${row.row}`;
      const quantity = parseIntStrict(v['quantity'] ?? '');
      const warehouse = v['warehouse'] ? byKey.get(norm(v['warehouse'])) : fallback;
      const errors: string[] = [];
      const variantId = bySku.get(sku);
      if (!sku) errors.push('SKU الزامی است.');
      else if (!variantId) errors.push(`SKU «${sku}» یافت نشد.`);
      if (!warehouse)
        errors.push(
          v['warehouse']
            ? `انبار «${v['warehouse']}» یافت نشد یا غیرفعال است.`
            : 'انبار پیش‌فرضی تعریف نشده است.',
        );
      if (quantity === undefined || quantity === null || quantity < 0)
        errors.push('موجودی باید عدد صحیح صفر یا بیشتر باشد.');
      const key = `${sku}|${warehouse?.id}`;
      if (errors.length === 0 && seen.has(key))
        errors.push('این SKU و انبار در همین فایل تکرار شده است.');
      if (
        errors.length > 0 ||
        !variantId ||
        !warehouse ||
        quantity === undefined ||
        quantity === null
      ) {
        results.push(rowResult(row.row, 'error', label, errors));
        continue;
      }
      seen.add(key);
      try {
        const level = await this.prisma.inventoryLevel.findUnique({
          where: { variantId_warehouseId: { variantId, warehouseId: warehouse.id } },
        });
        const same = (level?.onHand ?? 0) === quantity && level !== null;
        if (!dryRun && !same) {
          await this.inventory.applyOperation(
            {
              variantId,
              warehouseId: warehouse.id,
              type: 'set',
              quantity,
              reference: 'import',
              note: v['note'] || 'ورود از فایل',
            },
            actor.userId,
          );
        }
        results.push(
          rowResult(row.row, same ? 'unchanged' : 'update', label, [
            `${warehouse.code}: ${level?.onHand ?? 0} ← ${quantity}`,
          ]),
        );
      } catch (error) {
        results.push(
          rowResult(row.row, 'error', label, [
            error instanceof AppException ? error.message : 'ذخیره انجام نشد.',
          ]),
        );
      }
    }
    return results;
  }
}
