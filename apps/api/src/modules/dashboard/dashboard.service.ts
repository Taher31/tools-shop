import { Injectable } from '@nestjs/common';
import type { DashboardStats, OrderStatus } from '@toolshop/shared';
import { toRial } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { toAdminOrderSummary } from '../orders/order.mapper';
import { startOfJalaliMonth, startOfTehranDay, tehranDateKey } from './tehran-time';

const REVENUE_STATUSES: OrderStatus[] = ['paid', 'processing', 'packed', 'shipped', 'delivered'];
const CHART_DAYS = 14;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async stats(): Promise<DashboardStats> {
    const today = startOfTehranDay();
    const month = startOfJalaliMonth();
    const chartStart = new Date(today.getTime() - (CHART_DAYS - 1) * 86_400_000);
    const revenue = { status: { in: REVENUE_STATUSES } };

    const [salesToday, salesMonth, awaitingFulfillment, awaitingPayment, customersCount, lowStockItems, lowStockCount, recent, daily, top] =
      await Promise.all([
        this.prisma.order.aggregate({ where: { ...revenue, paidAt: { gte: today } }, _sum: { total: true }, _count: { _all: true } }),
        this.prisma.order.aggregate({ where: { ...revenue, paidAt: { gte: month } }, _sum: { total: true }, _count: { _all: true } }),
        this.prisma.order.count({ where: { status: { in: ['paid', 'processing', 'packed'] } } }),
        this.prisma.order.count({ where: { status: 'awaiting_payment' } }),
        this.prisma.user.count({ where: { type: 'customer' } }),
        this.inventory.lowStock(8),
        this.inventory.countLowStock(),
        this.prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            items: { select: { quantity: true } },
            user: { select: { id: true, firstName: true, lastName: true, mobile: true } },
          },
        }),
        this.prisma.order.findMany({
          where: { ...revenue, paidAt: { gte: chartStart } },
          select: { paidAt: true, total: true },
        }),
        this.prisma.orderItem.groupBy({
          by: ['productId'],
          where: { productId: { not: null }, order: { ...revenue, paidAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5,
        }),
      ]);

    const byDay = new Map<string, { total: number; orders: number }>();
    for (let i = 0; i < CHART_DAYS; i += 1) {
      byDay.set(tehranDateKey(new Date(chartStart.getTime() + i * 86_400_000)), { total: 0, orders: 0 });
    }
    for (const order of daily) {
      if (!order.paidAt) continue;
      const bucket = byDay.get(tehranDateKey(order.paidAt));
      if (bucket) {
        bucket.total += toRial(order.total);
        bucket.orders += 1;
      }
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: top.flatMap((row) => row.productId ?? []) } },
      select: { id: true, title: true, slug: true },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    return {
      salesToday: toRial(salesToday._sum.total ?? 0n),
      salesMonth: toRial(salesMonth._sum.total ?? 0n),
      ordersToday: salesToday._count._all,
      ordersMonth: salesMonth._count._all,
      awaitingFulfillment,
      awaitingPayment,
      lowStockCount,
      customersCount,
      salesByDay: [...byDay.entries()].map(([date, value]) => ({ date, ...value })),
      lowStockItems,
      topProducts: top.flatMap((row) => {
        const product = row.productId ? productsById.get(row.productId) : undefined;
        return product
          ? [
              {
                productId: product.id,
                title: product.title,
                slug: product.slug,
                quantity: row._sum.quantity ?? 0,
                revenue: toRial(row._sum.total ?? 0n),
              },
            ]
          : [];
      }),
      recentOrders: recent.map(toAdminOrderSummary),
    };
  }
}
