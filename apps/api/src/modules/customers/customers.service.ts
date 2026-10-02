import { Injectable } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import type {
  CustomerDetail,
  CustomerListItem,
  CustomerListQuery,
  Paginated,
} from '@toolshop/shared';
import { dayRange } from '../../common/utils/filters';
import { AppException } from '../../common/errors/app-exception';
import { toRial } from '../../common/utils/money';
import { paginate, paginationArgs } from '../../common/utils/pagination';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { toAddressView } from '../account/address.mapper';
import { AuditService } from '../audit/audit.service';
import { PrincipalService } from '../auth/principal.service';
import { SessionService } from '../auth/session.service';
import { toOrderSummary } from '../orders/order.mapper';

/** Orders that count as revenue for customer statistics. */
const REVENUE_STATUSES = ['paid', 'processing', 'packed', 'shipped', 'delivered'] as const;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly principals: PrincipalService,
    private readonly sessions: SessionService,
  ) {}

  async list(query: CustomerListQuery): Promise<Paginated<CustomerListItem>> {
    const where: Prisma.UserWhereInput = {
      type: 'customer',
      createdAt: dayRange(query),
      isActive: query.active,
      ...(query.hasOrders === undefined
        ? {}
        : query.hasOrders
          ? { orders: { some: { status: { in: [...REVENUE_STATUSES] } } } }
          : { orders: { none: { status: { in: [...REVENUE_STATUSES] } } } }),
      ...(query.q
        ? {
            OR: [
              { mobile: { contains: query.q } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              { firstName: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy:
          query.sort === 'oldest'
            ? { createdAt: 'asc' }
            : query.sort === 'name'
              ? [{ lastName: 'asc' }, { firstName: 'asc' }]
              : { createdAt: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    const stats = await this.stats(users.map((user) => user.id));
    return paginate(
      users.map((user) => ({
        id: user.id,
        fullName: `${user.firstName} ${user.lastName}`,
        mobile: user.mobile,
        email: user.email,
        isActive: user.isActive,
        ordersCount: stats.get(user.id)?.count ?? 0,
        totalSpent: stats.get(user.id)?.total ?? 0,
        createdAt: user.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  async get(id: string): Promise<CustomerDetail> {
    const user = await this.prisma.user.findFirst({
      where: { id, type: 'customer' },
      include: {
        addresses: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: { select: { quantity: true } } },
        },
      },
    });
    if (!user) throw AppException.notFound('مشتری یافت نشد.');
    const stats = (await this.stats([id])).get(id);
    return {
      id: user.id,
      fullName: `${user.firstName} ${user.lastName}`,
      mobile: user.mobile,
      email: user.email,
      isActive: user.isActive,
      ordersCount: stats?.count ?? 0,
      totalSpent: stats?.total ?? 0,
      createdAt: user.createdAt.toISOString(),
      nationalCode: user.nationalCode,
      addresses: user.addresses.map(toAddressView),
      recentOrders: user.orders.map(toOrderSummary),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  }

  async setActive(id: string, isActive: boolean): Promise<CustomerDetail> {
    const user = await this.prisma.user.findFirst({ where: { id, type: 'customer' } });
    if (!user) throw AppException.notFound('مشتری یافت نشد.');
    await this.prisma.user.update({ where: { id }, data: { isActive } });
    await this.audit.record({
      action: 'customer.status',
      entityType: 'user',
      entityId: id,
      summary: `${isActive ? 'فعال‌سازی' : 'غیرفعال‌سازی'} مشتری ${user.mobile ?? user.email}`,
      before: { isActive: user.isActive },
      after: { isActive },
    });
    await this.principals.invalidate(id);
    if (!isActive) await this.sessions.revokeAllForUser(id);
    return this.get(id);
  }

  private async stats(userIds: string[]): Promise<Map<string, { count: number; total: number }>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, status: { in: [...REVENUE_STATUSES] } },
      _count: { _all: true },
      _sum: { total: true },
    });
    return new Map(
      rows.map((row) => [
        row.userId,
        { count: row._count._all, total: toRial(row._sum.total ?? 0n) },
      ]),
    );
  }
}
