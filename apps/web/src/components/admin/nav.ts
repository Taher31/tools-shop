import type { Permission } from '@toolshop/shared';
import {
  Bot,
  Boxes,
  ClipboardList,
  CreditCard,
  FileText,
  History,
  KeyRound,
  LayoutDashboard,
  Layers,
  ListTree,
  MessageSquare,
  Package,
  Percent,
  Plug,
  Receipt,
  Settings,
  SlidersHorizontal,
  Tags,
  Ticket,
  Truck,
  BarChart3,
  Users,
  UserRound,
  Warehouse,
  CircleHelp,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  permission?: Permission;
  /** Live badge shown next to the label. */
  counter?: 'tickets';
  /** Planned module (shown disabled until its phase is delivered). */
  phase?: 2 | 3 | 4;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'فروش',
    items: [
      { href: '/admin', label: 'داشبورد', icon: LayoutDashboard, permission: 'dashboard.read' },
      { href: '/admin/orders', label: 'سفارش‌ها', icon: ClipboardList, permission: 'order.read' },
      { href: '/admin/payments', label: 'پرداخت‌ها', icon: CreditCard, permission: 'payment.read' },
      { href: '/admin/customers', label: 'مشتریان', icon: UserRound, permission: 'customer.read' },
      { href: '/admin/coupons', label: 'کدهای تخفیف', icon: Percent, permission: 'coupon.read' },
      {
        href: '/admin/shipping',
        label: 'روش‌های ارسال',
        icon: Truck,
        permission: 'shipping.manage',
      },
    ],
  },
  {
    label: 'کاتالوگ',
    items: [
      { href: '/admin/products', label: 'محصولات', icon: Package, permission: 'product.read' },
      {
        href: '/admin/categories',
        label: 'دسته‌بندی‌ها',
        icon: ListTree,
        permission: 'category.read',
      },
      { href: '/admin/brands', label: 'برندها', icon: Tags, permission: 'brand.read' },
      {
        href: '/admin/attributes',
        label: 'ویژگی‌های فنی',
        icon: SlidersHorizontal,
        permission: 'attribute.read',
      },
    ],
  },
  {
    label: 'انبار',
    items: [
      { href: '/admin/inventory', label: 'موجودی', icon: Boxes, permission: 'inventory.read' },
      {
        href: '/admin/warehouses',
        label: 'انبارها',
        icon: Warehouse,
        permission: 'warehouse.read',
      },
    ],
  },
  {
    label: 'ارتباط با مشتری',
    items: [
      {
        href: '/admin/reviews',
        label: 'نظرات',
        icon: MessageSquare,
        permission: 'review.moderate',
      },
      {
        href: '/admin/questions',
        label: 'پرسش‌ها',
        icon: CircleHelp,
        permission: 'question.answer',
      },
      {
        href: '/admin/content',
        label: 'صفحات و FAQ',
        icon: FileText,
        permission: 'content.manage',
      },
      {
        href: '/admin/tickets',
        label: 'پشتیبانی',
        icon: Ticket,
        permission: 'ticket.read',
        counter: 'tickets',
      },
    ],
  },
  {
    label: 'سیستم',
    items: [
      { href: '/admin/users', label: 'کاربران', icon: Users, permission: 'user.read' },
      {
        href: '/admin/roles',
        label: 'نقش‌ها و دسترسی‌ها',
        icon: KeyRound,
        permission: 'role.read',
      },
      { href: '/admin/settings', label: 'تنظیمات', icon: Settings, permission: 'settings.read' },
      {
        href: '/admin/audit-logs',
        label: 'گزارش رویدادها',
        icon: History,
        permission: 'audit.read',
      },
      {
        href: '/admin/invoices',
        label: 'فاکتورها و اسناد',
        icon: Receipt,
        permission: 'invoice.read',
      },
      {
        href: '/admin/integrations',
        label: 'مرکز اتصال‌ها',
        icon: Plug,
        permission: 'integration.read',
      },
      { href: '/admin/ai', label: 'مرکز هوش مصنوعی', icon: Bot, permission: 'ai.read' },
      { href: '/admin/reports', label: 'گزارش‌ها و تحلیل', icon: BarChart3, phase: 4 },
    ],
  },
];

export const ADMIN_NAV_ICON_FALLBACK = Layers;
