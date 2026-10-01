/**
 * Granular permission catalog. Keys follow `<resource>.<action>`.
 * The database `Permission` table is synced from this catalog by the seed, so adding a
 * permission here and re-running the seed is all that is needed to make it assignable.
 */
export const PERMISSION_CATALOG = {
  dashboard: {
    label: 'داشبورد و گزارش‌ها',
    permissions: {
      'dashboard.read': 'مشاهده داشبورد',
    },
  },
  product: {
    label: 'محصولات',
    permissions: {
      'product.read': 'مشاهده محصولات',
      'product.create': 'ایجاد محصول',
      'product.update': 'ویرایش محصول',
      'product.delete': 'حذف محصول',
      'product.price.update': 'تغییر قیمت',
    },
  },
  category: {
    label: 'دسته‌بندی‌ها',
    permissions: {
      'category.read': 'مشاهده دسته‌بندی‌ها',
      'category.create': 'ایجاد دسته‌بندی',
      'category.update': 'ویرایش دسته‌بندی',
      'category.delete': 'حذف دسته‌بندی',
    },
  },
  brand: {
    label: 'برندها',
    permissions: {
      'brand.read': 'مشاهده برندها',
      'brand.create': 'ایجاد برند',
      'brand.update': 'ویرایش برند',
      'brand.delete': 'حذف برند',
    },
  },
  attribute: {
    label: 'ویژگی‌های فنی',
    permissions: {
      'attribute.read': 'مشاهده ویژگی‌ها',
      'attribute.create': 'ایجاد ویژگی',
      'attribute.update': 'ویرایش ویژگی',
      'attribute.delete': 'حذف ویژگی',
    },
  },
  media: {
    label: 'رسانه',
    permissions: {
      'media.upload': 'بارگذاری فایل',
    },
  },
  inventory: {
    label: 'انبار و موجودی',
    permissions: {
      'inventory.read': 'مشاهده موجودی',
      'inventory.update': 'تغییر موجودی',
      'warehouse.read': 'مشاهده انبارها',
      'warehouse.manage': 'مدیریت انبارها',
    },
  },
  order: {
    label: 'سفارش‌ها',
    permissions: {
      'order.read': 'مشاهده سفارش‌ها',
      'order.update': 'تغییر وضعیت سفارش',
      'order.cancel': 'لغو سفارش',
    },
  },
  payment: {
    label: 'پرداخت‌ها',
    permissions: {
      'payment.read': 'مشاهده پرداخت‌ها',
      'payment.refund': 'بازپرداخت وجه',
    },
  },
  customer: {
    label: 'مشتریان',
    permissions: {
      'customer.read': 'مشاهده مشتریان',
      'customer.update': 'ویرایش مشتری',
    },
  },
  coupon: {
    label: 'تخفیف و کوپن',
    permissions: {
      'coupon.read': 'مشاهده کوپن‌ها',
      'coupon.manage': 'مدیریت کوپن‌ها',
    },
  },
  shipping: {
    label: 'روش‌های ارسال',
    permissions: {
      'shipping.manage': 'مدیریت روش‌های ارسال',
    },
  },
  review: {
    label: 'نظرات و پرسش‌ها',
    permissions: {
      'review.moderate': 'بررسی نظرات',
      'question.answer': 'پاسخ به پرسش‌ها',
    },
  },
  content: {
    label: 'محتوا',
    permissions: {
      'content.manage': 'مدیریت صفحات و سوالات متداول',
    },
  },
  user: {
    label: 'کاربران مدیریتی',
    permissions: {
      'user.read': 'مشاهده کاربران',
      'user.manage': 'مدیریت کاربران',
    },
  },
  integration: {
    label: 'مرکز اتصال‌ها',
    permissions: {
      'integration.read': 'مشاهده اتصال‌ها و گزارش همگام‌سازی',
      'integration.manage': 'فعال‌سازی، اعتبارنامه و همگام‌سازی',
    },
  },
  invoice: {
    label: 'فاکتورها و اسناد',
    permissions: {
      'invoice.read': 'مشاهده و چاپ فاکتورها',
      'invoice.issue': 'صدور فاکتور برای سفارش‌های قدیمی',
    },
  },
  ticket: {
    label: 'پشتیبانی',
    permissions: {
      'ticket.read': 'مشاهده تیکت‌ها',
      'ticket.reply': 'پاسخ به تیکت‌ها',
      'ticket.manage': 'ارجاع، اولویت و بستن تیکت',
    },
  },
  role: {
    label: 'نقش‌ها و دسترسی‌ها',
    permissions: {
      'role.read': 'مشاهده نقش‌ها',
      'role.manage': 'مدیریت نقش‌ها',
    },
  },
  settings: {
    label: 'تنظیمات',
    permissions: {
      'settings.read': 'مشاهده تنظیمات',
      'settings.update': 'تغییر تنظیمات',
    },
  },
  audit: {
    label: 'گزارش رویدادها',
    permissions: {
      'audit.read': 'مشاهده گزارش رویدادها',
    },
  },
  search: {
    label: 'جستجو',
    permissions: {
      'search.reindex': 'بازسازی ایندکس جستجو',
    },
  },
} as const;

type Catalog = typeof PERMISSION_CATALOG;
export type PermissionGroupKey = keyof Catalog;
export type Permission = {
  [Group in PermissionGroupKey]: keyof Catalog[Group]['permissions'];
}[PermissionGroupKey] &
  string;

export interface PermissionDefinition {
  key: Permission;
  group: PermissionGroupKey;
  groupLabel: string;
  label: string;
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = Object.entries(
  PERMISSION_CATALOG,
).flatMap(([group, definition]) =>
  Object.entries(definition.permissions).map(([key, label]) => ({
    key: key as Permission,
    group: group as PermissionGroupKey,
    groupLabel: definition.label,
    label,
  })),
);

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSION_DEFINITIONS.map((p) => p.key);

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

export const SUPER_ADMIN_ROLE = 'super_admin';

export interface SystemRoleDefinition {
  key: string;
  name: string;
  description: string;
  permissions: readonly Permission[];
}

const CATALOG_READ: readonly Permission[] = [
  'product.read',
  'category.read',
  'brand.read',
  'attribute.read',
];

/**
 * Default roles created by the seed. `super_admin` always holds every permission and
 * cannot be edited; the others are starting points that administrators can change.
 */
export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    key: SUPER_ADMIN_ROLE,
    name: 'مدیر ارشد',
    description: 'دسترسی کامل به همه بخش‌ها (غیرقابل ویرایش)',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'admin',
    name: 'مدیر',
    description: 'مدیریت فروشگاه به‌جز نقش‌ها و دسترسی‌ها',
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'role.manage'),
  },
  {
    key: 'sales',
    name: 'فروش',
    description: 'مدیریت سفارش‌ها، مشتریان و کوپن‌ها',
    permissions: [
      'dashboard.read',
      ...CATALOG_READ,
      'inventory.read',
      'order.read',
      'order.update',
      'order.cancel',
      'payment.read',
      'customer.read',
      'coupon.read',
      'coupon.manage',
      'ticket.read',
      'ticket.reply',
      'invoice.read',
      'invoice.issue',
    ],
  },
  {
    key: 'warehouse',
    name: 'انبار',
    description: 'مدیریت موجودی، انبارها و آماده‌سازی سفارش',
    permissions: [
      'dashboard.read',
      ...CATALOG_READ,
      'inventory.read',
      'inventory.update',
      'warehouse.read',
      'warehouse.manage',
      'order.read',
      'order.update',
    ],
  },
  {
    key: 'support',
    name: 'پشتیبانی',
    description: 'پاسخ به مشتریان، پرسش‌ها و نظرات',
    permissions: [
      'dashboard.read',
      ...CATALOG_READ,
      'inventory.read',
      'order.read',
      'customer.read',
      'review.moderate',
      'question.answer',
      'ticket.read',
      'ticket.reply',
      'ticket.manage',
      'invoice.read',
    ],
  },
  {
    key: 'content_manager',
    name: 'مدیر محتوا',
    description: 'مدیریت محصولات، دسته‌بندی‌ها و محتوای سایت',
    permissions: [
      'dashboard.read',
      ...CATALOG_READ,
      'product.create',
      'product.update',
      'category.create',
      'category.update',
      'brand.create',
      'brand.update',
      'attribute.create',
      'attribute.update',
      'media.upload',
      'content.manage',
      'review.moderate',
      'question.answer',
    ],
  },
];

export function hasPermission(
  granted: Iterable<string>,
  required: Permission | readonly Permission[],
): boolean {
  const grantedSet = granted instanceof Set ? (granted as Set<string>) : new Set(granted);
  const requiredList = typeof required === 'string' ? [required] : required;
  return requiredList.every((permission) => grantedSet.has(permission));
}
