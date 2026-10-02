import { Injectable } from '@nestjs/common';
import { brandUpsertSchema } from '@toolshop/shared';
import { AppException } from '../../../common/errors/app-exception';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BrandsService } from '../../catalog/brands.service';
import {
  type ColumnDef,
  type EntityHandler,
  type ExportTable,
  type ImportContext,
  issueMessages,
  type ParsedRow,
  rowResult,
} from '../entity-handler';
import { norm, parseBool } from '../value-parsers';

const COLUMNS: ColumnDef[] = [
  {
    key: 'name',
    header: 'نام برند',
    required: true,
    aliases: ['name', 'نام'],
    description: 'نام فارسی برند؛ کلید تشخیص ردیف تکراری',
    example: 'بوش',
  },
  {
    key: 'englishName',
    header: 'نام انگلیسی',
    aliases: ['english_name'],
    required: false,
    description: 'نام لاتین برند',
    example: 'Bosch',
  },
  {
    key: 'country',
    header: 'کشور',
    aliases: ['country'],
    required: false,
    description: 'کشور سازنده',
    example: 'آلمان',
  },
  {
    key: 'website',
    header: 'وب‌سایت',
    aliases: ['website'],
    required: false,
    description: 'آدرس کامل سایت برند',
    example: 'https://www.bosch.com',
  },
  {
    key: 'description',
    header: 'توضیحات',
    aliases: ['description'],
    required: false,
    description: 'معرفی کوتاه برند',
    example: 'تولیدکننده ابزار برقی',
  },
  {
    key: 'isActive',
    header: 'فعال',
    aliases: ['active'],
    required: false,
    description: 'بله یا خیر؛ پیش‌فرض بله',
    example: 'بله',
  },
];

@Injectable()
export class BrandsHandler implements EntityHandler {
  readonly key = 'brands' as const;
  readonly label = 'برندها';
  readonly description = 'برندها با نام فارسی و انگلیسی؛ ردیف همنام، به‌روزرسانی می‌شود.';
  readonly columns = COLUMNS;
  readonly dynamicColumns = null;
  readonly importPermissions = ['brand.create', 'brand.update'] as const as never;
  readonly exportPermissions = ['brand.read'] as const as never;

  constructor(
    private readonly prisma: PrismaService,
    private readonly brands: BrandsService,
  ) {}

  sample(): string[][] {
    return [
      ['بوش', 'Bosch', 'آلمان', 'https://www.bosch.com', 'تولیدکننده ابزار برقی', 'بله'],
      ['مکیتا', 'Makita', 'ژاپن', '', '', 'بله'],
    ];
  }

  async export(): Promise<ExportTable> {
    const brands = await this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
    return {
      headers: COLUMNS.map((c) => c.header),
      rows: brands.map((b) => [
        b.name,
        b.englishName,
        b.country,
        b.website,
        b.description,
        b.isActive ? 'بله' : 'خیر',
      ]),
    };
  }

  async import(rows: ParsedRow[], { dryRun }: ImportContext) {
    const existing = new Map((await this.prisma.brand.findMany()).map((b) => [norm(b.name), b]));
    const seen = new Set<string>();
    const results = [];
    for (const row of rows) {
      const v = row.values;
      const label = v['name'] || `ردیف ${row.row}`;
      const active = parseBool(v['isActive'] ?? '');
      if (active === null) {
        results.push(rowResult(row.row, 'error', label, ['فعال: فقط «بله» یا «خیر» مجاز است.']));
        continue;
      }
      const current = existing.get(norm(v['name'] ?? ''));
      // Blank cells keep the stored value; only filled cells change it.
      const parsed = brandUpsertSchema.safeParse({
        name: v['name'],
        englishName: v['englishName'] || current?.englishName,
        country: v['country'] || current?.country,
        website: v['website'] || current?.website,
        description: v['description'] || current?.description,
        logoUrl: current?.logoUrl,
        seoTitle: current?.seoTitle,
        seoDescription: current?.seoDescription,
        isActive: active ?? current?.isActive ?? true,
      });
      if (!parsed.success) {
        results.push(
          rowResult(
            row.row,
            'error',
            label,
            issueMessages(parsed.error.issues, (p) =>
              p === 'name' ? 'نام برند' : p === 'website' ? 'وب‌سایت' : null,
            ),
          ),
        );
        continue;
      }
      const key = norm(parsed.data.name);
      if (seen.has(key)) {
        results.push(rowResult(row.row, 'error', label, ['این برند در همین فایل تکرار شده است.']));
        continue;
      }
      seen.add(key);
      const id = existing.get(key)?.id;
      try {
        if (!dryRun) {
          if (id) await this.brands.update(id, parsed.data);
          else await this.brands.create(parsed.data);
        }
        results.push(rowResult(row.row, id ? 'update' : 'create', label));
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
