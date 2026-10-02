import { Injectable } from '@nestjs/common';
import {
  adminOrderListQuerySchema,
  type ImportRowResult,
  ORDER_STATUS_LABELS,
  customerListQuerySchema,
} from '@toolshop/shared';
import { CustomersService } from '../../customers/customers.service';
import { OrdersService } from '../../orders/orders.service';
import type { ColumnDef, EntityHandler, ExportTable } from '../entity-handler';
import { formatDayJalali, toTomanText } from '../value-parsers';

const NOT_IMPORTABLE = async (): Promise<ImportRowResult[]> => [];

const ORDER_COLUMNS: ColumnDef[] = [
  {
    key: 'orderNumber',
    header: 'شماره سفارش',
    required: false,
    description: '',
    example: '100012',
  },
  {
    key: 'date',
    header: 'تاریخ ثبت',
    required: false,
    description: 'تاریخ شمسی (ساعت تهران)',
    example: '1405/07/10',
  },
  { key: 'customer', header: 'مشتری', required: false, description: '', example: 'مشتری نمونه' },
  { key: 'mobile', header: 'موبایل', required: false, description: '', example: '09120000001' },
  { key: 'status', header: 'وضعیت', required: false, description: '', example: 'پرداخت‌شده' },
  { key: 'items', header: 'تعداد اقلام', required: false, description: '', example: '2' },
  { key: 'total', header: 'مبلغ (تومان)', required: false, description: '', example: '1580000' },
];

/** Reads every page of an admin list (up to 5000 rows) for download. */
async function allPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; totalPages: number }>,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const result = await fetchPage(page);
    items.push(...result.items);
    if (page >= result.totalPages) break;
  }
  return items;
}

@Injectable()
export class OrdersExportHandler implements EntityHandler {
  readonly key = 'orders' as const;
  readonly label = 'سفارش‌ها';
  readonly description = 'خروجی سفارش‌ها با همان فیلترهای فهرست (تاریخ، وضعیت، مبلغ…). فقط خروجی.';
  readonly columns = ORDER_COLUMNS;
  readonly dynamicColumns = null;
  readonly importPermissions = null;
  readonly exportPermissions = ['order.read'] as const as never;

  constructor(private readonly orders: OrdersService) {}

  sample(): string[][] {
    return [];
  }

  import = NOT_IMPORTABLE;

  async export(query: Record<string, unknown>): Promise<ExportTable> {
    const parsed = adminOrderListQuerySchema.parse({ ...query, page: 1, pageSize: 100 });
    const orders = await allPages((page) => this.orders.listForAdmin({ ...parsed, page }));
    return {
      headers: ORDER_COLUMNS.map((c) => c.header),
      rows: orders.map((o) => [
        o.orderNumber,
        formatDayJalali(o.createdAt),
        o.customer.fullName,
        o.customer.mobile,
        ORDER_STATUS_LABELS[o.status],
        o.itemsCount,
        toTomanText(o.total),
      ]),
    };
  }
}

const CUSTOMER_COLUMNS: ColumnDef[] = [
  { key: 'name', header: 'نام', required: false, description: '', example: 'مشتری نمونه' },
  { key: 'mobile', header: 'موبایل', required: false, description: '', example: '09120000001' },
  {
    key: 'email',
    header: 'ایمیل',
    required: false,
    description: '',
    example: 'customer@example.com',
  },
  { key: 'joined', header: 'تاریخ عضویت', required: false, description: '', example: '1405/06/01' },
  { key: 'orders', header: 'تعداد سفارش', required: false, description: '', example: '3' },
  {
    key: 'spent',
    header: 'جمع خرید (تومان)',
    required: false,
    description: '',
    example: '4500000',
  },
  { key: 'active', header: 'وضعیت حساب', required: false, description: '', example: 'فعال' },
];

@Injectable()
export class CustomersExportHandler implements EntityHandler {
  readonly key = 'customers' as const;
  readonly label = 'مشتریان';
  readonly description =
    'خروجی مشتریان با فیلترهای فهرست. فقط خروجی (ورود مشتری از فایل پشتیبانی نمی‌شود).';
  readonly columns = CUSTOMER_COLUMNS;
  readonly dynamicColumns = null;
  readonly importPermissions = null;
  readonly exportPermissions = ['customer.read'] as const as never;

  constructor(private readonly customers: CustomersService) {}

  sample(): string[][] {
    return [];
  }

  import = NOT_IMPORTABLE;

  async export(query: Record<string, unknown>): Promise<ExportTable> {
    const parsed = customerListQuerySchema.parse({ ...query, page: 1, pageSize: 100 });
    const customers = await allPages((page) => this.customers.list({ ...parsed, page }));
    return {
      headers: CUSTOMER_COLUMNS.map((c) => c.header),
      rows: customers.map((c) => [
        c.fullName,
        c.mobile,
        c.email,
        formatDayJalali(c.createdAt),
        c.ordersCount,
        toTomanText(c.totalSpent),
        c.isActive ? 'فعال' : 'مسدود',
      ]),
    };
  }
}
