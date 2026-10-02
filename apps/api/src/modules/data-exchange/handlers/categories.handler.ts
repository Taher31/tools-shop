import { Injectable } from '@nestjs/common';
import { categoryUpsertSchema } from '@toolshop/shared';
import { AppException } from '../../../common/errors/app-exception';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CategoriesService } from '../../catalog/categories.service';
import {
  type ColumnDef,
  type EntityHandler,
  type ExportTable,
  type ImportContext,
  issueMessages,
  type ParsedRow,
  rowResult,
} from '../entity-handler';
import { norm, parseBool, parseIntStrict } from '../value-parsers';

const COLUMNS: ColumnDef[] = [
  {
    key: 'path',
    header: 'مسیر دسته‌بندی',
    required: true,
    aliases: ['path', 'category', 'دسته‌بندی', 'نام'],
    description:
      'نام دسته؛ برای زیرمجموعه مسیر کامل با «>» بنویسید. والدها باید قبلاً وجود داشته باشند یا بالاتر در همین فایل بیایند.',
    example: 'ابزار برقی > دریل',
  },
  {
    key: 'description',
    header: 'توضیحات',
    required: false,
    aliases: ['description'],
    description: 'توضیح کوتاه دسته',
    example: 'دریل‌های شارژی و برقی',
  },
  {
    key: 'sortOrder',
    header: 'ترتیب نمایش',
    required: false,
    aliases: ['sort', 'sortorder'],
    description: 'عدد کوچک‌تر بالاتر نمایش داده می‌شود',
    example: '10',
  },
  {
    key: 'isActive',
    header: 'فعال',
    required: false,
    aliases: ['active'],
    description: 'بله یا خیر؛ پیش‌فرض بله',
    example: 'بله',
  },
];

const SEPARATOR = /\s*[>›»/\\]\s*/;

@Injectable()
export class CategoriesHandler implements EntityHandler {
  readonly key = 'categories' as const;
  readonly label = 'دسته‌بندی‌ها';
  readonly description = 'درخت دسته‌بندی با مسیر کامل؛ ردیف با مسیر یکسان، به‌روزرسانی می‌شود.';
  readonly columns = COLUMNS;
  readonly dynamicColumns = null;
  readonly importPermissions = ['category.create', 'category.update'] as const as never;
  readonly exportPermissions = ['category.read'] as const as never;

  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  sample(): string[][] {
    return [
      ['ابزار برقی', 'ابزارهای برقی و شارژی', '10', 'بله'],
      ['ابزار برقی > دریل', 'دریل‌های شارژی و برقی', '10', 'بله'],
      ['ابزار دستی', '', '20', 'بله'],
    ];
  }

  private async tree() {
    const all = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const byId = new Map(all.map((c) => [c.id, c]));
    const pathOf = (id: string): string => {
      const parts: string[] = [];
      const seen = new Set<string>();
      let current = byId.get(id);
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        parts.unshift(current.name);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      return parts.join(' > ');
    };
    return { all, pathOf };
  }

  async export(): Promise<ExportTable> {
    const { all, pathOf } = await this.tree();
    return {
      headers: COLUMNS.map((c) => c.header),
      rows: all
        .map((c) => [pathOf(c.id), c.description, c.sortOrder, c.isActive ? 'بله' : 'خیر'] as const)
        .sort((a, b) => a[0].localeCompare(b[0], 'fa'))
        .map((r) => [...r]),
    };
  }

  async import(rows: ParsedRow[], { dryRun }: ImportContext) {
    const { all, pathOf } = await this.tree();
    // normalised full path → id (dry runs get synthetic ids so children still resolve).
    const ids = new Map(all.map((c) => [norm(pathOf(c.id)), c.id]));
    const byFullPath = new Map(all.map((c) => [norm(pathOf(c.id)), c]));
    const results = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const v = row.values;
      const label = v['path'] || `ردیف ${row.row}`;
      const parts = (v['path'] ?? '')
        .split(SEPARATOR)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length === 0) {
        results.push(rowResult(row.row, 'error', label, ['مسیر دسته‌بندی الزامی است.']));
        continue;
      }
      const name = parts.at(-1) as string;
      const parentPath = parts.slice(0, -1).join(' > ');
      const parentId = parentPath ? ids.get(norm(parentPath)) : null;
      if (parentPath && !parentId) {
        results.push(
          rowResult(row.row, 'error', label, [
            `دسته والد «${parentPath}» پیدا نشد؛ آن را بالاتر در همین فایل یا قبلاً بسازید.`,
          ]),
        );
        continue;
      }
      const active = parseBool(v['isActive'] ?? '');
      const sort = parseIntStrict(v['sortOrder'] ?? '');
      if (active === null || sort === null) {
        results.push(
          rowResult(row.row, 'error', label, [
            active === null ? 'فعال: فقط «بله» یا «خیر» مجاز است.' : 'ترتیب نمایش باید عدد باشد.',
          ]),
        );
        continue;
      }
      const current = byFullPath.get(norm(parts.join(' > ')));
      const parsed = categoryUpsertSchema.safeParse({
        name,
        parentId: parentId ?? null,
        description: v['description'] || current?.description,
        imageUrl: current?.imageUrl,
        seoTitle: current?.seoTitle,
        seoDescription: current?.seoDescription,
        sortOrder: sort ?? current?.sortOrder ?? 0,
        isActive: active ?? current?.isActive ?? true,
      });
      if (!parsed.success) {
        results.push(rowResult(row.row, 'error', label, issueMessages(parsed.error.issues)));
        continue;
      }
      const key = norm(parts.join(' > '));
      if (seen.has(key)) {
        results.push(rowResult(row.row, 'error', label, ['این مسیر در همین فایل تکرار شده است.']));
        continue;
      }
      seen.add(key);
      const id = ids.get(key);
      try {
        if (dryRun) {
          if (!id) ids.set(key, `new:${row.row}`);
        } else if (id) {
          await this.categories.update(id, parsed.data);
        } else {
          const created = await this.categories.create(parsed.data);
          ids.set(key, created.id);
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
