import { Injectable } from '@nestjs/common';
import {
  type AdminProductDetail,
  adminProductListQuerySchema,
  hasPermission,
  type ImportRowResult,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUSES,
  type ProductStatus,
  productUpsertSchema,
  USAGE_TYPE_LABELS,
  USAGE_TYPES,
  type UsageType,
} from '@toolshop/shared';
import { AppException } from '../../../common/errors/app-exception';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { resolveAttributeValues } from '../../catalog/attribute-values';
import { AdminProductsService } from '../../catalog/products/admin-products.service';
import type { Taxonomy, TaxonomyAttribute } from '../../catalog/taxonomy';
import { TaxonomyService } from '../../catalog/taxonomy.service';
import { InventoryService } from '../../inventory/inventory.service';
import {
  type ColumnDef,
  type EntityHandler,
  type ExportTable,
  type ImportContext,
  type ParsedRow,
  rowResult,
} from '../entity-handler';
import {
  norm,
  parseBool,
  parseIntStrict,
  parseList,
  parseTomanToRial,
  textToHtml,
  toTomanText,
} from '../value-parsers';

/** Prefix of the free-form columns holding one specification each. */
const ATTRIBUTE_PREFIX = 'ویژگی:';

const COLUMNS: ColumnDef[] = [
  {
    key: 'productKey',
    header: 'کد گروه محصول',
    aliases: ['product_key', 'group'],
    required: false,
    description:
      'ردیف‌هایی که کد گروه یکسان دارند، تنوع‌های یک محصول هستند. خالی = ردیف‌های هم‌عنوان یک محصول‌اند.',
    example: 'DRILL-GSB',
  },
  {
    key: 'title',
    header: 'عنوان محصول',
    aliases: ['title', 'عنوان'],
    required: false,
    description: 'الزامی برای محصول جدید؛ عنوان فارسی (از اولین ردیف هر گروه خوانده می‌شود)',
    example: 'دریل شارژی ۱۸ ولت بوش',
  },
  {
    key: 'englishTitle',
    header: 'عنوان انگلیسی',
    aliases: ['english_title'],
    required: false,
    description: 'برای نامک (آدرس) و جست‌وجو',
    example: 'Bosch GSB 18V Cordless Drill',
  },
  {
    key: 'category',
    header: 'دسته‌بندی',
    aliases: ['category'],
    required: false,
    description: 'الزامی برای محصول جدید؛ نام یا مسیر دسته با «>»؛ باید قبلاً وجود داشته باشد',
    example: 'ابزار برقی > دریل',
  },
  {
    key: 'brand',
    header: 'برند',
    aliases: ['brand'],
    required: false,
    description: 'نام برند؛ باید قبلاً وجود داشته باشد',
    example: 'بوش',
  },
  {
    key: 'model',
    header: 'مدل',
    aliases: ['model'],
    required: false,
    description: 'مدل سازنده',
    example: 'GSB 18V-50',
  },
  {
    key: 'status',
    header: 'وضعیت',
    aliases: ['status'],
    required: false,
    description:
      'فعال، پیش‌نویس یا بایگانی؛ پیش‌فرض پیش‌نویس (محصول فعال باید ویژگی‌های الزامی دسته را داشته باشد)',
    example: 'فعال',
  },
  {
    key: 'shortDescription',
    header: 'توضیح کوتاه',
    aliases: ['short_description'],
    required: false,
    description: 'حداکثر ۶۰۰ نویسه',
    example: 'دریل شارژی حرفه‌ای با موتور براشلس',
  },
  {
    key: 'description',
    header: 'توضیحات کامل',
    aliases: ['description'],
    required: false,
    description: 'متن ساده (پاراگراف‌ها با خط خالی) یا HTML ساده',
    example: 'دریل شارژی ۱۸ ولت با گشتاور بالا…',
  },
  {
    key: 'warranty',
    header: 'گارانتی',
    aliases: ['warranty'],
    required: false,
    description: 'مثلاً «۱۸ ماه گارانتی اصالت و سلامت فیزیکی»',
    example: '۱۸ ماه',
  },
  {
    key: 'countryOfOrigin',
    header: 'کشور سازنده',
    aliases: ['country'],
    required: false,
    description: '',
    example: 'آلمان',
  },
  {
    key: 'manufacturer',
    header: 'سازنده',
    aliases: ['manufacturer'],
    required: false,
    description: '',
    example: 'Robert Bosch GmbH',
  },
  {
    key: 'usageType',
    header: 'نوع کاربری',
    aliases: ['usage_type'],
    required: false,
    description: 'خانگی، نیمه‌صنعتی یا صنعتی',
    example: 'نیمه‌صنعتی',
  },
  {
    key: 'tags',
    header: 'برچسب‌ها',
    aliases: ['tags'],
    required: false,
    description: 'با | یا ، جدا کنید',
    example: 'دریل|شارژی|براشلس',
  },
  {
    key: 'images',
    header: 'تصاویر',
    aliases: ['images'],
    required: false,
    description:
      'نشانی تصاویر (https://…) با | جدا شده؛ اولی تصویر اصلی. تصاویر موجود جایگزین می‌شوند.',
    example: 'https://example.com/a.jpg|https://example.com/b.jpg',
  },
  {
    key: 'featured',
    header: 'ویژه',
    aliases: ['featured'],
    required: false,
    description: 'بله یا خیر',
    example: 'خیر',
  },
  {
    key: 'seoTitle',
    header: 'عنوان سئو',
    aliases: ['seo_title'],
    required: false,
    description: '',
    example: 'خرید دریل شارژی بوش',
  },
  {
    key: 'seoDescription',
    header: 'توضیحات سئو',
    aliases: ['seo_description'],
    required: false,
    description: '',
    example: 'قیمت و خرید دریل شارژی ۱۸ ولت بوش با گارانتی',
  },
  {
    key: 'sku',
    header: 'SKU',
    aliases: ['sku'],
    required: true,
    description:
      'کد یکتای هر تنوع (انگلیسی). اگر SKU قبلاً وجود داشته باشد، همان محصول به‌روزرسانی می‌شود.',
    example: 'BSH-GSB-18V',
  },
  {
    key: 'barcode',
    header: 'بارکد',
    aliases: ['barcode'],
    required: false,
    description: '',
    example: '4059952000000',
  },
  {
    key: 'variantTitle',
    header: 'عنوان تنوع',
    aliases: ['variant_title'],
    required: false,
    description: 'مثلاً «با دو باتری»',
    example: 'با دو باتری ۴ آمپر',
  },
  {
    key: 'variantOptions',
    header: 'گزینه‌های تنوع',
    aliases: ['options'],
    required: false,
    description: 'به شکل نام=مقدار و با | جدا شده',
    example: 'رنگ=آبی|باتری=۴Ah',
  },
  {
    key: 'price',
    header: 'قیمت (تومان)',
    aliases: ['price'],
    required: false,
    description:
      'الزامی برای محصول جدید؛ قیمت فروش به تومان (برای به‌روزرسانی می‌توانید خالی بگذارید)',
    example: '8900000',
  },
  {
    key: 'compareAtPrice',
    header: 'قیمت قبل از تخفیف (تومان)',
    aliases: ['compare_at_price'],
    required: false,
    description: 'باید بیشتر از قیمت فروش باشد',
    example: '9900000',
  },
  {
    key: 'lowStockThreshold',
    header: 'حد کم‌موجودی',
    aliases: ['low_stock'],
    required: false,
    description: 'پیش‌فرض ۲',
    example: '2',
  },
  {
    key: 'weightGrams',
    header: 'وزن (گرم)',
    aliases: ['weight'],
    required: false,
    description: '',
    example: '1800',
  },
  {
    key: 'variantActive',
    header: 'تنوع فعال',
    aliases: ['variant_active'],
    required: false,
    description: 'بله یا خیر؛ پیش‌فرض بله',
    example: 'بله',
  },
  {
    key: 'stock',
    header: 'موجودی',
    aliases: ['stock'],
    required: false,
    description: 'موجودی نهایی این SKU در انبار زیر؛ خالی = بدون تغییر',
    example: '25',
  },
  {
    key: 'warehouse',
    header: 'کد انبار',
    aliases: ['warehouse'],
    required: false,
    description: 'خالی = انبار پیش‌فرض',
    example: 'MAIN',
  },
];

const KEY_HEADER = new Map(COLUMNS.map((c) => [c.key, c.header]));
const headerOf = (key: string) => KEY_HEADER.get(key) ?? key;

const FIELD_COLUMN: Record<string, string> = {
  title: 'title',
  englishTitle: 'englishTitle',
  categoryId: 'category',
  brandId: 'brand',
  model: 'model',
  status: 'status',
  shortDescription: 'shortDescription',
  description: 'description',
  warranty: 'warranty',
  countryOfOrigin: 'countryOfOrigin',
  manufacturer: 'manufacturer',
  usageType: 'usageType',
  tags: 'tags',
  images: 'images',
  seoTitle: 'seoTitle',
  seoDescription: 'seoDescription',
  sku: 'sku',
  barcode: 'barcode',
  options: 'variantOptions',
  price: 'price',
  compareAtPrice: 'compareAtPrice',
  lowStockThreshold: 'lowStockThreshold',
  weightGrams: 'weightGrams',
  isActive: 'variantActive',
};

interface VariantDraft {
  row: number;
  sku: string;
  fields: Record<string, unknown>;
  stock: number | null;
  warehouseKey: string;
}

interface Group {
  rows: ParsedRow[];
  title: string;
}

const first = (rows: ParsedRow[], key: string): string =>
  rows.find((r) => r.values[key])?.values[key] ?? '';

@Injectable()
export class ProductsHandler implements EntityHandler {
  readonly key = 'products' as const;
  readonly label = 'محصولات';
  readonly description =
    'محصولات با تنوع‌ها، قیمت، موجودی، تصاویر، سئو و ویژگی‌های فنی (ستون «ویژگی: نام» برای هر ویژگی). هر ردیف یک تنوع (SKU) است.';
  readonly columns = COLUMNS;
  readonly dynamicColumns =
    'برای هر ویژگی فنی دسته‌بندی یک ستون با عنوان «ویژگی: نام ویژگی» اضافه کنید، مثلاً «ویژگی: توان (وات)». ویژگی‌های انتخابی را با برچسب گزینه بنویسید و چند گزینه را با | جدا کنید.';
  readonly importPermissions = ['product.create', 'product.update'] as const as never;
  readonly exportPermissions = ['product.read'] as const as never;

  constructor(
    private readonly prisma: PrismaService,
    private readonly products: AdminProductsService,
    private readonly taxonomy: TaxonomyService,
    private readonly inventory: InventoryService,
  ) {}

  sample(): string[][] {
    const base = (over: Record<string, string>) => COLUMNS.map((c) => over[c.key] ?? '');
    return [
      base({
        productKey: 'DRILL-GSB',
        title: 'دریل شارژی ۱۸ ولت بوش',
        englishTitle: 'Bosch GSB 18V Cordless Drill',
        category: 'ابزار برقی > دریل',
        brand: 'بوش',
        model: 'GSB 18V-50',
        status: 'فعال',
        shortDescription: 'دریل شارژی حرفه‌ای با موتور براشلس',
        description: 'دریل شارژی ۱۸ ولت با گشتاور بالا.\n\nمناسب کار خانگی و نیمه‌صنعتی.',
        warranty: '۱۸ ماه',
        countryOfOrigin: 'آلمان',
        usageType: 'نیمه‌صنعتی',
        tags: 'دریل|شارژی|براشلس',
        images: 'https://example.com/images/drill-1.jpg|https://example.com/images/drill-2.jpg',
        featured: 'خیر',
        sku: 'BSH-GSB-18V-1B',
        barcode: '',
        variantTitle: 'با یک باتری',
        variantOptions: 'باتری=۱ عدد',
        price: '8900000',
        compareAtPrice: '9900000',
        lowStockThreshold: '2',
        weightGrams: '1800',
        variantActive: 'بله',
        stock: '25',
        warehouse: 'MAIN',
      }),
      base({
        productKey: 'DRILL-GSB',
        sku: 'BSH-GSB-18V-2B',
        variantTitle: 'با دو باتری',
        variantOptions: 'باتری=۲ عدد',
        price: '10900000',
        stock: '12',
        warehouse: 'MAIN',
      }),
      base({
        title: 'مته فلزکار HSS مجموعه ۱۹ عددی',
        category: 'ابزار برقی > دریل',
        brand: 'بوش',
        status: 'پیش‌نویس',
        sku: 'BSH-HSS-19',
        price: '650000',
        stock: '40',
      }),
    ];
  }

  /* --------------------------------------------------------------- export */

  async export(query: Record<string, unknown>): Promise<ExportTable> {
    const parsed = adminProductListQuerySchema.parse({ ...query, page: 1, pageSize: 100 });
    const taxonomy = await this.taxonomy.get();
    const details: AdminProductDetail[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const batch = await this.products.list({ ...parsed, page, pageSize: 100 });
      details.push(...(await this.products.getMany(batch.items.map((p) => p.id))));
      if (page >= batch.totalPages) break;
    }

    const usedAttributes = new Map<string, TaxonomyAttribute>();
    for (const product of details)
      for (const value of product.attributes) {
        const attribute = taxonomy.attributesById.get(value.attributeId);
        if (attribute) usedAttributes.set(attribute.id, attribute);
      }
    const attributes = [...usedAttributes.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'fa'),
    );
    const brandName = (id: string | null) => (id ? (taxonomy.brandsById.get(id)?.name ?? '') : '');
    const categoryPath = (id: string) =>
      taxonomy
        .ancestors(id)
        .map((c) => c.name)
        .join(' > ');

    const rows: (string | number | null)[][] = [];
    for (const product of details) {
      const specs = new Map(product.attributes.map((a) => [a.attributeId, a.value]));
      product.variants.forEach((variant, index) => {
        const head = index === 0;
        const warehouses = variant.levels;
        // Stock is only exported when it is unambiguous (single warehouse).
        const single = warehouses.length === 1 ? warehouses[0] : undefined;
        const base: (string | number | null)[] = [
          product.slug,
          head ? product.title : '',
          head ? product.englishTitle : '',
          head ? categoryPath(product.categoryId) : '',
          head ? brandName(product.brandId) : '',
          head ? product.model : '',
          head ? PRODUCT_STATUS_LABELS[product.status] : '',
          head ? product.shortDescription : '',
          head ? product.description : '',
          head ? product.warranty : '',
          head ? product.countryOfOrigin : '',
          head ? product.manufacturer : '',
          head && product.usageType ? USAGE_TYPE_LABELS[product.usageType] : '',
          head ? product.tags.join('|') : '',
          head ? product.images.map((i) => i.url).join('|') : '',
          head ? (product.isFeatured ? 'بله' : 'خیر') : '',
          head ? product.seoTitle : '',
          head ? product.seoDescription : '',
          variant.sku,
          variant.barcode,
          variant.title,
          variant.options.map((o) => `${o.name}=${o.value}`).join('|'),
          toTomanText(variant.price),
          toTomanText(variant.compareAtPrice),
          variant.lowStockThreshold,
          variant.weightGrams,
          variant.isActive ? 'بله' : 'خیر',
          single ? single.onHand : null,
          single ? single.warehouseCode : null,
        ];
        for (const attribute of attributes) {
          base.push(head ? this.attributeText(attribute, specs.get(attribute.id), taxonomy) : '');
        }
        rows.push(base);
      });
    }
    return {
      headers: [
        ...COLUMNS.map((c) => c.header),
        ...attributes.map((a) => `${ATTRIBUTE_PREFIX} ${a.name}`),
      ],
      rows,
    };
  }

  private attributeText(
    attribute: TaxonomyAttribute,
    value: string | number | boolean | string[] | undefined,
    taxonomy: Taxonomy,
  ): string {
    if (value === undefined || value === '') return '';
    if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
    if (Array.isArray(value)) return value.map((v) => taxonomy.optionLabel(attribute, v)).join('|');
    if (attribute.type === 'select') return taxonomy.optionLabel(attribute, String(value));
    return String(value);
  }

  /* -------------------------------------------------------------- import */

  async import(rows: ParsedRow[], { dryRun, actor }: ImportContext): Promise<ImportRowResult[]> {
    const taxonomy = await this.taxonomy.get();
    const lookups = this.lookups(taxonomy);
    const warehouses = await this.prisma.warehouse.findMany({ where: { isActive: true } });
    const warehouseByKey = new Map(
      warehouses.flatMap(
        (w) =>
          [
            [norm(w.code), w],
            [norm(w.name), w],
          ] as const,
      ),
    );
    const defaultWarehouse = warehouses.find((w) => w.isDefault) ?? warehouses[0];

    const allSkus = [
      ...new Set(rows.map((r) => (r.values['sku'] ?? '').toUpperCase()).filter(Boolean)),
    ];
    const existingVariants = await this.prisma.productVariant.findMany({
      where: { sku: { in: allSkus }, deletedAt: null, product: { deletedAt: null } },
      select: { sku: true, id: true, productId: true },
    });
    const existingBySku = new Map(existingVariants.map((v) => [v.sku.toUpperCase(), v]));

    // Group rows into products, keeping file order.
    const groups = new Map<string, Group>();
    const results: ImportRowResult[] = [];
    for (const row of rows) {
      const key =
        norm(row.values['productKey'] ?? '') ||
        (row.values['title'] ? `t:${norm(row.values['title'])}` : '') ||
        // Update-only files may carry just SKU + the changed columns.
        this.skuGroupKey(row.values['sku'] ?? '', existingBySku);
      if (!key) {
        results.push(
          rowResult(row.row, 'error', `ردیف ${row.row}`, [
            '«کد گروه محصول» یا «عنوان محصول» لازم است.',
          ]),
        );
        continue;
      }
      const group = groups.get(key) ?? { rows: [], title: '' };
      group.rows.push(row);
      groups.set(key, group);
    }

    const seenSkus = new Map<string, number>();
    const canSetStock = hasPermission(actor.permissions, 'inventory.update');
    const canPrice = hasPermission(actor.permissions, 'product.price.update');

    for (const group of groups.values()) {
      const head = group.rows[0] as ParsedRow;
      const title =
        first(group.rows, 'title') || first(group.rows, 'productKey') || `ردیف ${head.row}`;
      const rowErrors = new Map<number, string[]>();
      const fail = (row: number, message: string) =>
        rowErrors.set(row, [...(rowErrors.get(row) ?? []), message]);

      // --- variants -------------------------------------------------------
      const drafts: VariantDraft[] = [];
      for (const row of group.rows) {
        const draft = this.variantDraft(row, fail);
        if (!draft) continue;
        const previous = seenSkus.get(draft.sku);
        if (previous !== undefined)
          fail(row.row, `SKU «${draft.sku}» در ردیف ${previous} هم آمده است.`);
        seenSkus.set(draft.sku, row.row);
        drafts.push(draft);
      }

      // --- create or update? ---------------------------------------------
      const productIds = new Set(
        drafts
          .map((d) => existingBySku.get(d.sku)?.productId)
          .filter((id): id is string => Boolean(id)),
      );
      if (productIds.size > 1) fail(head.row, 'SKUهای این گروه متعلق به چند محصول مختلف‌اند.');
      const existing =
        productIds.size === 1
          ? await this.products.get([...productIds][0] as string).catch(() => null)
          : null;

      // --- product-level fields -------------------------------------------
      const v = (key: string) => first(group.rows, key);
      const fields: Record<string, unknown> = {};
      const set = (field: string, value: unknown) => {
        if (value !== '' && value !== undefined) fields[field] = value;
      };
      set('title', v('title'));
      set('englishTitle', v('englishTitle'));
      set('model', v('model'));
      set('shortDescription', v('shortDescription'));
      if (v('description')) fields['description'] = textToHtml(v('description'));
      set('warranty', v('warranty'));
      set('countryOfOrigin', v('countryOfOrigin'));
      set('manufacturer', v('manufacturer'));
      set('seoTitle', v('seoTitle'));
      set('seoDescription', v('seoDescription'));
      if (v('tags')) fields['tags'] = parseList(v('tags'));
      if (v('images'))
        fields['images'] = parseList(v('images')).map((url) => ({
          url,
          alt: v('title') || existing?.title || title,
        }));
      if (v('category')) {
        const id = lookups.category(v('category'));
        if (id === undefined)
          fail(
            head.row,
            `${headerOf('category')}: «${v('category')}» پیدا نشد؛ ابتدا آن را در بخش دسته‌بندی‌ها بسازید.`,
          );
        else if (id === null)
          fail(
            head.row,
            `${headerOf('category')}: «${v('category')}» چند دسته همنام دارد؛ مسیر کامل را بنویسید.`,
          );
        else fields['categoryId'] = id;
      }
      if (v('brand')) {
        const id = lookups.brand(v('brand'));
        if (!id)
          fail(
            head.row,
            `${headerOf('brand')}: «${v('brand')}» پیدا نشد؛ ابتدا آن را در بخش برندها بسازید.`,
          );
        else fields['brandId'] = id;
      }
      if (v('status')) {
        const status = lookups.status(v('status'));
        if (!status)
          fail(
            head.row,
            `${headerOf('status')}: یکی از «فعال»، «پیش‌نویس» یا «بایگانی» را بنویسید.`,
          );
        else fields['status'] = status;
      }
      if (v('usageType')) {
        const usage = lookups.usage(v('usageType'));
        if (!usage)
          fail(
            head.row,
            `${headerOf('usageType')}: یکی از «خانگی»، «نیمه‌صنعتی» یا «صنعتی» را بنویسید.`,
          );
        else fields['usageType'] = usage;
      }
      if (v('featured')) {
        const featured = parseBool(v('featured'));
        if (featured === null)
          fail(head.row, `${headerOf('featured')}: فقط «بله» یا «خیر» مجاز است.`);
        else if (featured !== undefined) fields['isFeatured'] = featured;
      }

      // --- attributes -------------------------------------------------------
      const categoryId = (fields['categoryId'] as string | undefined) ?? existing?.categoryId;
      const attributeValues = new Map<string, string | number | boolean | string[]>(
        (existing?.attributes ?? []).map((a) => [a.attributeId, a.value]),
      );
      for (const row of group.rows) {
        for (const [header, text] of Object.entries(row.extra)) {
          if (
            !header.startsWith(ATTRIBUTE_PREFIX) &&
            !norm(header).startsWith(norm(ATTRIBUTE_PREFIX))
          )
            continue;
          if (text === '') continue;
          const name = header.slice(header.indexOf(':') + 1).trim();
          const attribute = lookups.attribute(name);
          if (!attribute) {
            fail(row.row, `${header}: ویژگی «${name}» تعریف نشده است.`);
            continue;
          }
          const converted = this.attributeValue(attribute, text);
          if (converted === null)
            fail(row.row, `${header}: مقدار «${text}» برای این ویژگی معتبر نیست.`);
          else attributeValues.set(attribute.id, converted);
        }
      }

      // --- compose the upsert input -----------------------------------------
      if (!existing && !fields['categoryId'])
        fail(head.row, `${headerOf('category')} برای محصول جدید الزامی است.`);
      if (!existing && !fields['title'])
        fail(head.row, `${headerOf('title')} برای محصول جدید الزامی است.`);
      if (drafts.length === 0 && rowErrors.size === 0)
        fail(head.row, 'هیچ تنوعی (SKU) برای این محصول نیست.');

      const variantInputs = this.mergeVariants(existing, drafts, existingBySku);
      const input: Record<string, unknown> = {
        ...(existing ? this.detailToInput(existing) : {}),
        ...fields,
        attributes: [...attributeValues.entries()]
          .filter(
            ([attributeId]) =>
              !categoryId ||
              taxonomy.effectiveAttributes(categoryId).some((e) => e.attribute.id === attributeId),
          )
          .map(([attributeId, value]) => ({ attributeId, value })),
        variants: variantInputs.map((x) => x.input),
      };
      if (existing && fields['categoryId'] && fields['categoryId'] !== existing.categoryId) {
        // A category change keeps only the specs that still apply.
        input['attributes'] = (input['attributes'] as { attributeId: string }[]).filter((a) =>
          taxonomy
            .effectiveAttributes(fields['categoryId'] as string)
            .some((e) => e.attribute.id === a.attributeId),
        );
      }

      const parsed = productUpsertSchema.safeParse(input);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const [root, index, field] = issue.path.map(String);
          if (root === 'variants' && index !== undefined && field !== undefined) {
            const draft = variantInputs[Number(index)];
            fail(
              draft?.row ?? head.row,
              `${headerOf(FIELD_COLUMN[field] ?? field)}: ${issue.message}`,
            );
          } else {
            fail(
              head.row,
              `${root ? headerOf(FIELD_COLUMN[root] ?? root) : 'محصول'}: ${issue.message}`,
            );
          }
        }
      }

      // Same spec validation the save performs, so the preview matches the real import.
      if (parsed.success) {
        const checked = resolveAttributeValues(
          parsed.data.attributes,
          taxonomy.effectiveAttributes(parsed.data.categoryId),
          { enforceRequired: parsed.data.status === 'active' },
        );
        for (const error of checked.errors) {
          fail(
            head.row,
            error.message +
              (parsed.data.status === 'active' ? ' (یا وضعیت را «پیش‌نویس» بگذارید)' : ''),
          );
        }
      }

      // --- permissions and stock ---------------------------------------------
      if (parsed.success) {
        if (existing) {
          const priceChanged = parsed.data.variants.some((variant) => {
            const old = existing.variants.find((x) => x.sku === variant.sku);
            return (
              old && (old.price !== variant.price || old.compareAtPrice !== variant.compareAtPrice)
            );
          });
          if (priceChanged && !canPrice) fail(head.row, 'شما مجوز تغییر قیمت محصولات را ندارید.');
        }
        for (const draft of drafts) {
          if (draft.stock === null) continue;
          if (!canSetStock)
            fail(draft.row, 'شما مجوز ثبت موجودی انبار را ندارید (ستون موجودی را خالی بگذارید).');
          const warehouse = draft.warehouseKey
            ? warehouseByKey.get(norm(draft.warehouseKey))
            : defaultWarehouse;
          if (!warehouse)
            fail(
              draft.row,
              draft.warehouseKey
                ? `${headerOf('warehouse')}: انبار «${draft.warehouseKey}» پیدا نشد.`
                : 'انبار پیش‌فرضی تعریف نشده است.',
            );
        }
      }

      if (rowErrors.size > 0 || !parsed.success) {
        for (const row of group.rows) {
          const own = rowErrors.get(row.row);
          results.push(
            rowResult(
              row.row,
              'error',
              row === head ? title : (row.values['sku'] ?? `ردیف ${row.row}`),
              own ?? ['این ردیف به‌خاطر خطای ردیف دیگری از همین محصول ثبت نشد.'],
            ),
          );
        }
        continue;
      }

      // --- write ---------------------------------------------------------------
      const status = existing ? 'update' : 'create';
      const note = `${parsed.data.variants.length} تنوع`;
      if (dryRun) {
        results.push(rowResult(head.row, status, title, [note]));
        continue;
      }
      try {
        const saved = existing
          ? await this.products.update(existing.id, parsed.data, actor)
          : await this.products.create(parsed.data);
        const messages = [note];
        for (const draft of drafts) {
          if (draft.stock === null) continue;
          const variant = saved.variants.find((x) => x.sku === draft.sku);
          const warehouse = draft.warehouseKey
            ? warehouseByKey.get(norm(draft.warehouseKey))
            : defaultWarehouse;
          if (!variant || !warehouse) continue;
          try {
            await this.inventory.applyOperation(
              {
                variantId: variant.id,
                warehouseId: warehouse.id,
                type: 'set',
                quantity: draft.stock,
                reference: 'import',
                note: 'ورود از فایل',
              },
              actor.userId,
            );
          } catch (error) {
            messages.push(
              `موجودی ${draft.sku}: ${error instanceof AppException ? error.message : 'ثبت نشد'}`,
            );
          }
        }
        results.push(rowResult(head.row, status, title, messages));
      } catch (error) {
        const details = error instanceof AppException ? this.errorDetails(error) : [];
        results.push(
          rowResult(
            head.row,
            'error',
            title,
            details.length > 0
              ? details
              : [error instanceof AppException ? error.message : 'ذخیره انجام نشد.'],
          ),
        );
      }
    }
    return results.sort((a, b) => a.row - b.row);
  }

  private skuGroupKey(sku: string, existingBySku: Map<string, { productId: string }>): string {
    const upper = sku.toUpperCase();
    if (!upper) return '';
    const product = existingBySku.get(upper)?.productId;
    return product ? `p:${product}` : `sku:${upper}`;
  }

  private errorDetails(error: AppException): string[] {
    const body = error.getResponse() as {
      message?: string;
      details?: { path: string; message: string }[];
    };
    return (body.details ?? []).map((d) => d.message);
  }

  private variantDraft(
    row: ParsedRow,
    fail: (row: number, message: string) => void,
  ): VariantDraft | null {
    const v = row.values;
    const sku = (v['sku'] ?? '').toUpperCase();
    if (!sku) {
      fail(row.row, `${headerOf('sku')} الزامی است.`);
      return null;
    }
    const fields: Record<string, unknown> = { sku };
    const price = parseTomanToRial(v['price'] ?? '');
    const compare = parseTomanToRial(v['compareAtPrice'] ?? '');
    const threshold = parseIntStrict(v['lowStockThreshold'] ?? '');
    const weight = parseIntStrict(v['weightGrams'] ?? '');
    const active = parseBool(v['variantActive'] ?? '');
    const stock = parseIntStrict(v['stock'] ?? '');
    for (const [key, parsed] of [
      ['price', price],
      ['compareAtPrice', compare],
      ['lowStockThreshold', threshold],
      ['weightGrams', weight],
      ['stock', stock],
    ] as const) {
      if (parsed === null) fail(row.row, `${headerOf(key)}: عدد معتبر نیست.`);
    }
    if (active === null)
      fail(row.row, `${headerOf('variantActive')}: فقط «بله» یا «خیر» مجاز است.`);
    if (stock !== undefined && stock !== null && stock < 0)
      fail(row.row, `${headerOf('stock')}: نمی‌تواند منفی باشد.`);
    if (price !== undefined && price !== null) fields['price'] = price;
    if (compare !== undefined && compare !== null) fields['compareAtPrice'] = compare;
    if (threshold !== undefined && threshold !== null) fields['lowStockThreshold'] = threshold;
    if (weight !== undefined && weight !== null) fields['weightGrams'] = weight;
    if (active !== undefined && active !== null) fields['isActive'] = active;
    if (v['barcode']) fields['barcode'] = v['barcode'];
    if (v['variantTitle']) fields['title'] = v['variantTitle'];
    if (v['variantOptions']) {
      const options = parseList(v['variantOptions']).map((pair) => {
        const [name, ...rest] = pair.split('=');
        return { name: (name ?? '').trim(), value: rest.join('=').trim() };
      });
      if (options.some((o) => !o.name || !o.value))
        fail(row.row, `${headerOf('variantOptions')}: هر گزینه باید به شکل نام=مقدار باشد.`);
      else fields['options'] = options;
    }
    return { row: row.row, sku, fields, stock: stock ?? null, warehouseKey: v['warehouse'] ?? '' };
  }

  /** Existing variants (kept, optionally updated) followed by new SKUs from the file. */
  private mergeVariants(
    existing: AdminProductDetail | null,
    drafts: VariantDraft[],
    existingBySku: Map<string, { id: string }>,
  ): { row: number; input: Record<string, unknown> }[] {
    const byDraft = new Map(drafts.map((d) => [d.sku, d]));
    const merged: { row: number; input: Record<string, unknown> }[] = [];
    for (const old of existing?.variants ?? []) {
      const draft = byDraft.get(old.sku.toUpperCase());
      merged.push({
        row: draft?.row ?? 0,
        input: {
          id: old.id,
          sku: old.sku,
          barcode: old.barcode,
          title: old.title,
          options: old.options,
          price: old.price,
          compareAtPrice: old.compareAtPrice,
          lowStockThreshold: old.lowStockThreshold,
          weightGrams: old.weightGrams,
          isActive: old.isActive,
          ...(draft?.fields ?? {}),
        },
      });
      byDraft.delete(old.sku.toUpperCase());
    }
    for (const draft of byDraft.values()) {
      const known = existingBySku.get(draft.sku);
      merged.push({
        row: draft.row,
        input: { ...(known ? { id: known.id } : {}), ...draft.fields },
      });
    }
    return merged;
  }

  private detailToInput(detail: AdminProductDetail): Record<string, unknown> {
    return {
      title: detail.title,
      englishTitle: detail.englishTitle,
      slug: detail.slug,
      status: detail.status,
      categoryId: detail.categoryId,
      brandId: detail.brandId,
      model: detail.model,
      manufacturer: detail.manufacturer,
      countryOfOrigin: detail.countryOfOrigin,
      usageType: detail.usageType,
      warranty: detail.warranty,
      shortDescription: detail.shortDescription,
      description: detail.description,
      videoUrl: detail.videoUrl,
      tags: detail.tags,
      images: detail.images,
      relatedProductIds: detail.relatedProductIds,
      accessoryProductIds: detail.accessoryProductIds,
      isFeatured: detail.isFeatured,
      canonicalUrl: detail.canonicalUrl,
      seoTitle: detail.seoTitle,
      seoDescription: detail.seoDescription,
    };
  }

  private attributeValue(
    attribute: TaxonomyAttribute,
    text: string,
  ): string | number | boolean | string[] | null {
    switch (attribute.type) {
      case 'number':
        return text;
      case 'boolean': {
        const flag = parseBool(text);
        return flag === null || flag === undefined ? null : flag;
      }
      case 'select':
      case 'multiselect': {
        const wanted = attribute.type === 'select' ? [text] : parseList(text);
        const values: string[] = [];
        for (const item of wanted) {
          const option = attribute.options.find(
            (o) => norm(o.label) === norm(item) || norm(o.value) === norm(item),
          );
          if (!option) return null;
          values.push(option.value);
        }
        return attribute.type === 'select' ? (values[0] ?? null) : values;
      }
      default:
        return text;
    }
  }

  private lookups(taxonomy: Taxonomy) {
    const categoryPaths = new Map<string, string[]>();
    for (const category of taxonomy.categoriesById.values()) {
      const path = norm(
        taxonomy
          .ancestors(category.id)
          .map((c) => c.name)
          .join('>'),
      );
      categoryPaths.set(path, [...(categoryPaths.get(path) ?? []), category.id]);
      const byName = norm(category.name);
      categoryPaths.set(byName, [...(categoryPaths.get(byName) ?? []), category.id]);
      categoryPaths.set(`slug:${category.slug}`, [category.id]);
    }
    const brands = new Map<string, string>();
    for (const brand of taxonomy.brandsById.values()) {
      brands.set(norm(brand.name), brand.id);
      if (brand.englishName) brands.set(norm(brand.englishName), brand.id);
    }
    const attributes = new Map<string, TaxonomyAttribute>();
    for (const attribute of taxonomy.attributesById.values()) {
      attributes.set(norm(attribute.name), attribute);
      attributes.set(norm(attribute.code), attribute);
    }
    const statuses = new Map<string, ProductStatus>();
    for (const status of PRODUCT_STATUSES) {
      statuses.set(norm(status), status);
      statuses.set(norm(PRODUCT_STATUS_LABELS[status]), status);
    }
    statuses.set(norm('آرشیو'), 'archived');
    statuses.set(norm('منتشر شده'), 'active');
    const usages = new Map<string, UsageType>();
    for (const usage of USAGE_TYPES) {
      usages.set(norm(usage), usage);
      usages.set(norm(USAGE_TYPE_LABELS[usage]), usage);
    }
    return {
      /** id, null when ambiguous, undefined when unknown. */
      category: (text: string): string | null | undefined => {
        const normalised = norm(text.split(/\s*[>›»]\s*/).join('>'));
        const ids = categoryPaths.get(normalised) ?? categoryPaths.get(`slug:${text.trim()}`);
        return ids === undefined ? undefined : ids.length === 1 ? (ids[0] as string) : null;
      },
      brand: (text: string) => brands.get(norm(text)),
      attribute: (text: string) => attributes.get(norm(text)),
      status: (text: string) => statuses.get(norm(text)),
      usage: (text: string) => usages.get(norm(text)),
    };
  }
}
