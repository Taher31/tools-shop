import { Injectable } from '@nestjs/common';
import {
  COUPON_TYPE_LABELS,
  COUPON_TYPES,
  type CouponType,
  couponUpsertSchema,
} from '@toolshop/shared';
import { AppException } from '../../../common/errors/app-exception';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CouponsService } from '../../coupons/coupons.service';
import {
  type ColumnDef,
  type EntityHandler,
  type ExportTable,
  type ImportContext,
  issueMessages,
  type ParsedRow,
  rowResult,
} from '../entity-handler';
import {
  formatDayJalali,
  norm,
  parseBool,
  parseDay,
  parseIntStrict,
  parseTomanToRial,
  toTomanText,
} from '../value-parsers';

const COLUMNS: ColumnDef[] = [
  {
    key: 'code',
    header: 'کد تخفیف',
    required: true,
    aliases: ['code'],
    description: 'حروف انگلیسی، عدد، - و _؛ ۳ تا ۴۰ نویسه. کلید تشخیص ردیف تکراری.',
    example: 'MEHR1405',
  },
  {
    key: 'type',
    header: 'نوع',
    required: true,
    aliases: ['type'],
    description: 'درصدی، مبلغ ثابت یا ارسال رایگان',
    example: 'درصدی',
  },
  {
    key: 'value',
    header: 'مقدار',
    required: false,
    aliases: ['value'],
    description: 'برای درصدی: عدد ۱ تا ۱۰۰؛ برای مبلغ ثابت: تومان؛ برای ارسال رایگان خالی',
    example: '10',
  },
  {
    key: 'maxDiscount',
    header: 'سقف تخفیف (تومان)',
    required: false,
    aliases: ['max_discount'],
    description: 'فقط برای نوع درصدی',
    example: '500000',
  },
  {
    key: 'minSubtotal',
    header: 'حداقل خرید (تومان)',
    required: false,
    aliases: ['min_subtotal'],
    description: 'حداقل جمع سبد برای استفاده',
    example: '1000000',
  },
  {
    key: 'startsAt',
    header: 'شروع',
    required: false,
    aliases: ['starts_at'],
    description: 'تاریخ شمسی (۱۴۰۵/۰۷/۰۱) یا میلادی (2026-09-23)',
    example: '1405/07/01',
  },
  {
    key: 'endsAt',
    header: 'پایان',
    required: false,
    aliases: ['ends_at'],
    description: 'تا پایان همین روز معتبر است',
    example: '1405/07/30',
  },
  {
    key: 'usageLimit',
    header: 'سقف کل استفاده',
    required: false,
    aliases: ['usage_limit'],
    description: 'خالی = نامحدود',
    example: '100',
  },
  {
    key: 'perCustomerLimit',
    header: 'سقف هر مشتری',
    required: false,
    aliases: ['per_customer_limit'],
    description: 'خالی = نامحدود',
    example: '1',
  },
  {
    key: 'description',
    header: 'توضیحات',
    required: false,
    aliases: ['description'],
    description: 'یادداشت داخلی',
    example: 'جشنواره مهر',
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

const DAY_MS = 86_400_000;

@Injectable()
export class CouponsHandler implements EntityHandler {
  readonly key = 'coupons' as const;
  readonly label = 'کدهای تخفیف';
  readonly description =
    'کدهای تخفیف درصدی، مبلغ ثابت و ارسال رایگان؛ ردیف با کد یکسان، به‌روزرسانی می‌شود.';
  readonly columns = COLUMNS;
  readonly dynamicColumns = null;
  readonly importPermissions = ['coupon.manage'] as const as never;
  readonly exportPermissions = ['coupon.read'] as const as never;

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
  ) {}

  sample(): string[][] {
    return [
      [
        'MEHR1405',
        'درصدی',
        '10',
        '500000',
        '1000000',
        '1405/07/01',
        '1405/07/30',
        '100',
        '1',
        'جشنواره مهر',
        'بله',
      ],
      ['OFF200', 'مبلغ ثابت', '200000', '', '1500000', '', '', '', '', '', 'بله'],
      ['FREESHIP', 'ارسال رایگان', '', '', '2000000', '', '', '', '', '', 'بله'],
    ];
  }

  async export(): Promise<ExportTable> {
    const coupons = await this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    return {
      headers: COLUMNS.map((c) => c.header),
      rows: coupons.map((c) => [
        c.code,
        COUPON_TYPE_LABELS[c.type],
        c.type === 'percent' ? Number(c.value) : c.type === 'fixed' ? toTomanText(c.value) : '',
        toTomanText(c.maxDiscount),
        toTomanText(c.minSubtotal),
        formatDayJalali(c.startsAt),
        // The end is stored as the day's last instant; show the day itself.
        formatDayJalali(c.endsAt ? new Date(c.endsAt.getTime() - 1) : null),
        c.usageLimit,
        c.perCustomerLimit,
        c.description,
        c.isActive ? 'بله' : 'خیر',
      ]),
    };
  }

  async import(rows: ParsedRow[], { dryRun }: ImportContext) {
    const existing = new Map(
      (await this.prisma.coupon.findMany({ select: { id: true, code: true } })).map((c) => [
        c.code.toUpperCase(),
        c.id,
      ]),
    );
    const typeByLabel = new Map<string, CouponType>();
    for (const type of COUPON_TYPES) {
      typeByLabel.set(norm(type), type);
      typeByLabel.set(norm(COUPON_TYPE_LABELS[type]), type);
    }
    const seen = new Set<string>();
    const results = [];
    for (const row of rows) {
      const v = row.values;
      const label = v['code'] || `ردیف ${row.row}`;
      const errors: string[] = [];
      const type = typeByLabel.get(norm(v['type'] ?? ''));
      if (!type) errors.push('نوع: یکی از «درصدی»، «مبلغ ثابت» یا «ارسال رایگان» را بنویسید.');
      const maxDiscount = parseTomanToRial(v['maxDiscount'] ?? '');
      const minSubtotal = parseTomanToRial(v['minSubtotal'] ?? '');
      const usageLimit = parseIntStrict(v['usageLimit'] ?? '');
      const perCustomer = parseIntStrict(v['perCustomerLimit'] ?? '');
      const starts = parseDay(v['startsAt'] ?? '');
      const ends = parseDay(v['endsAt'] ?? '');
      const active = parseBool(v['isActive'] ?? '');
      let value = 0;
      if (type === 'percent') {
        const n = parseIntStrict(v['value'] ?? '');
        if (n === undefined || n === null) errors.push('مقدار: درصد تخفیف را به صورت عدد بنویسید.');
        else value = n;
      } else if (type === 'fixed') {
        const rial = parseTomanToRial(v['value'] ?? '');
        if (rial === undefined || rial === null)
          errors.push('مقدار: مبلغ تخفیف را به تومان بنویسید.');
        else value = rial;
      }
      for (const [name, parsed] of [
        ['سقف تخفیف', maxDiscount],
        ['حداقل خرید', minSubtotal],
        ['سقف کل استفاده', usageLimit],
        ['سقف هر مشتری', perCustomer],
      ] as const) {
        if (parsed === null) errors.push(`${name}: عدد معتبر نیست.`);
      }
      if (starts === null) errors.push('شروع: تاریخ معتبر نیست (مثل ۱۴۰۵/۰۷/۰۱).');
      if (ends === null) errors.push('پایان: تاریخ معتبر نیست (مثل ۱۴۰۵/۰۷/۳۰).');
      if (active === null) errors.push('فعال: فقط «بله» یا «خیر» مجاز است.');
      if (errors.length > 0 || !type) {
        results.push(rowResult(row.row, 'error', label, errors));
        continue;
      }
      const parsed = couponUpsertSchema.safeParse({
        code: v['code'],
        description: v['description'],
        type,
        value,
        maxDiscount: type === 'percent' ? maxDiscount : null,
        minSubtotal,
        startsAt: starts ?? null,
        // "Ends on day X" means through the end of that day.
        endsAt: ends ? new Date(ends.getTime() + DAY_MS) : null,
        usageLimit,
        perCustomerLimit: perCustomer,
        isActive: active ?? true,
      });
      if (!parsed.success) {
        results.push(
          rowResult(
            row.row,
            'error',
            label,
            issueMessages(parsed.error.issues, (p) => (p === 'code' ? 'کد تخفیف' : null)),
          ),
        );
        continue;
      }
      if (seen.has(parsed.data.code)) {
        results.push(rowResult(row.row, 'error', label, ['این کد در همین فایل تکرار شده است.']));
        continue;
      }
      seen.add(parsed.data.code);
      const id = existing.get(parsed.data.code);
      try {
        if (!dryRun) {
          if (id) await this.coupons.update(id, parsed.data);
          else await this.coupons.create(parsed.data);
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
