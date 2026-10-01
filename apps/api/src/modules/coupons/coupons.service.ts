import { Injectable } from '@nestjs/common';
import type { Coupon, Prisma } from '@toolshop/database';
import type { CouponUpsertInput, CouponView, ListQuery, Paginated } from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { toRial } from '../../common/utils/money';
import { paginate, paginationArgs } from '../../common/utils/pagination';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CouponRule } from '../pricing/pricing';

export interface CouponResolution {
  rule: CouponRule | null;
  couponId: string | null;
  description: string | null;
  error: string | null;
}

function toView(coupon: Coupon): CouponView {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    type: coupon.type,
    value: toRial(coupon.value),
    maxDiscount: toRial(coupon.maxDiscount),
    minSubtotal: toRial(coupon.minSubtotal),
    startsAt: coupon.startsAt?.toISOString() ?? null,
    endsAt: coupon.endsAt?.toISOString() ?? null,
    usageLimit: coupon.usageLimit,
    perCustomerLimit: coupon.perCustomerLimit,
    usedCount: coupon.usedCount,
    isActive: coupon.isActive,
    createdAt: coupon.createdAt.toISOString(),
  };
}

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Checks everything except the minimum subtotal (evaluated by the pricing engine). */
  async resolve(code: string, userId: string | undefined, client: Tx | PrismaService = this.prisma): Promise<CouponResolution> {
    const coupon = await client.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    const invalid = (error: string): CouponResolution => ({ rule: null, couponId: null, description: null, error });
    const now = new Date();
    if (!coupon || !coupon.isActive) return invalid('کد تخفیف معتبر نیست.');
    if (coupon.startsAt && coupon.startsAt > now) return invalid('زمان استفاده از این کد تخفیف هنوز شروع نشده است.');
    if (coupon.endsAt && coupon.endsAt <= now) return invalid('مهلت استفاده از این کد تخفیف به پایان رسیده است.');
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return invalid('ظرفیت استفاده از این کد تخفیف تکمیل شده است.');
    }
    if (userId && coupon.perCustomerLimit !== null) {
      const used = await client.couponRedemption.count({ where: { couponId: coupon.id, userId } });
      if (used >= coupon.perCustomerLimit) return invalid('شما قبلاً از این کد تخفیف استفاده کرده‌اید.');
    }
    return {
      rule: {
        code: coupon.code,
        type: coupon.type,
        value: toRial(coupon.value),
        maxDiscount: toRial(coupon.maxDiscount),
        minSubtotal: toRial(coupon.minSubtotal),
      },
      couponId: coupon.id,
      description: coupon.description,
      error: null,
    };
  }

  /** Consumes one use atomically; fails if the usage limit was reached concurrently. */
  async redeem(tx: Tx, input: { couponId: string; userId: string; orderId: string; amount: number }): Promise<void> {
    const consumed = await tx.$executeRaw`
      UPDATE "Coupon" SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
      WHERE "id" = ${input.couponId}::uuid AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
    if (consumed === 0) throw new AppException('INVALID_COUPON', 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.');
    await tx.couponRedemption.create({
      data: { couponId: input.couponId, userId: input.userId, orderId: input.orderId, amount: BigInt(input.amount) },
    });
  }

  /** Gives the use back when an unpaid order is cancelled or expires. */
  async releaseForOrder(tx: Tx, orderId: string): Promise<void> {
    const redemption = await tx.couponRedemption.findUnique({ where: { orderId } });
    if (!redemption) return;
    await tx.couponRedemption.delete({ where: { id: redemption.id } });
    await tx.$executeRaw`
      UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0), "updatedAt" = now()
      WHERE "id" = ${redemption.couponId}::uuid`;
  }

  async list(query: ListQuery): Promise<Paginated<CouponView>> {
    const where: Prisma.CouponWhereInput = query.q ? { code: { contains: query.q.toUpperCase() } } : {};
    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      this.prisma.coupon.count({ where }),
    ]);
    return paginate(coupons.map(toView), total, query);
  }

  async create(input: CouponUpsertInput): Promise<CouponView> {
    if (await this.prisma.coupon.findUnique({ where: { code: input.code } })) {
      throw AppException.conflict('این کد تخفیف قبلاً ثبت شده است.', [{ path: 'code', message: 'تکراری' }]);
    }
    const coupon = await this.prisma.$transaction(async (tx) => {
      const created = await tx.coupon.create({ data: this.toData(input) });
      await this.audit.record(
        { action: 'coupon.create', entityType: 'coupon', entityId: created.id, summary: `ایجاد کد تخفیف ${created.code}` },
        tx,
      );
      return created;
    });
    return toView(coupon);
  }

  async update(id: string, input: CouponUpsertInput): Promise<CouponView> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw AppException.notFound('کد تخفیف یافت نشد.');
    if (existing.code !== input.code && (await this.prisma.coupon.findUnique({ where: { code: input.code } }))) {
      throw AppException.conflict('این کد تخفیف قبلاً ثبت شده است.', [{ path: 'code', message: 'تکراری' }]);
    }
    const coupon = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.coupon.update({ where: { id }, data: this.toData(input) });
      await this.audit.record(
        {
          action: 'coupon.update',
          entityType: 'coupon',
          entityId: id,
          summary: `ویرایش کد تخفیف ${updated.code}`,
          before: { type: existing.type, value: existing.value, isActive: existing.isActive, endsAt: existing.endsAt },
          after: { type: updated.type, value: updated.value, isActive: updated.isActive, endsAt: updated.endsAt },
        },
        tx,
      );
      return updated;
    });
    return toView(coupon);
  }

  async remove(id: string): Promise<void> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw AppException.notFound('کد تخفیف یافت نشد.');
    await this.prisma.$transaction(async (tx) => {
      if (coupon.usedCount > 0) {
        await tx.coupon.update({ where: { id }, data: { isActive: false } });
      } else {
        await tx.coupon.delete({ where: { id } });
      }
      await this.audit.record(
        { action: 'coupon.delete', entityType: 'coupon', entityId: id, summary: `حذف/غیرفعال‌سازی کد ${coupon.code}` },
        tx,
      );
    });
  }

  private toData(input: CouponUpsertInput) {
    return {
      code: input.code,
      description: input.description,
      type: input.type,
      value: BigInt(input.type === 'free_shipping' ? 0 : input.value),
      maxDiscount: input.maxDiscount ? BigInt(input.maxDiscount) : null,
      minSubtotal: input.minSubtotal ? BigInt(input.minSubtotal) : null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      usageLimit: input.usageLimit,
      perCustomerLimit: input.perCustomerLimit,
      isActive: input.isActive,
    };
  }
}
