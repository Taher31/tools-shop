import { Injectable } from '@nestjs/common';
import type { ShippingMethod } from '@toolshop/database';
import type {
  ShippingMethodUpsertInput,
  ShippingMethodView,
  ShippingOption,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { toRial } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { ShippingRule } from '../pricing/pricing';

function toView(method: ShippingMethod): ShippingMethodView {
  const baseCost = toRial(method.baseCost);
  return {
    id: method.id,
    code: method.code,
    name: method.name,
    description: method.description,
    cost: baseCost,
    isFree: baseCost === 0,
    estimatedDaysMin: method.estimatedDaysMin,
    estimatedDaysMax: method.estimatedDaysMax,
    baseCost,
    freeShippingThreshold: toRial(method.freeShippingThreshold),
    provinces: method.provinces,
    isActive: method.isActive,
    sortOrder: method.sortOrder,
  };
}

export function serves(
  method: { provinces: string[] },
  province: string | null | undefined,
): boolean {
  return (
    method.provinces.length === 0 ||
    (province !== null && province !== undefined && method.provinces.includes(province))
  );
}

export function shippingRule(method: ShippingMethod): ShippingRule {
  return {
    cost: toRial(method.baseCost),
    freeShippingThreshold: toRial(method.freeShippingThreshold),
  };
}

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async activeMethods(): Promise<ShippingMethod[]> {
    return this.prisma.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Methods serving the province, with the cost for this order amount. */
  async optionsFor(province: string | null, merchandiseTotal: number): Promise<ShippingOption[]> {
    const methods = await this.activeMethods();
    return methods
      .filter((method) => serves(method, province))
      .map((method) => {
        const rule = shippingRule(method);
        const cost =
          rule.freeShippingThreshold !== null && merchandiseTotal >= rule.freeShippingThreshold
            ? 0
            : rule.cost;
        return {
          id: method.id,
          code: method.code,
          name: method.name,
          description: method.description,
          cost,
          isFree: cost === 0,
          estimatedDaysMin: method.estimatedDaysMin,
          estimatedDaysMax: method.estimatedDaysMax,
        };
      });
  }

  async list(): Promise<ShippingMethodView[]> {
    const methods = await this.prisma.shippingMethod.findMany({ orderBy: { sortOrder: 'asc' } });
    return methods.map(toView);
  }

  async create(input: ShippingMethodUpsertInput): Promise<ShippingMethodView> {
    if (await this.prisma.shippingMethod.findUnique({ where: { code: input.code } })) {
      throw AppException.conflict('کد روش ارسال تکراری است.', [
        { path: 'code', message: 'تکراری' },
      ]);
    }
    const method = await this.prisma.shippingMethod.create({ data: this.toData(input) });
    await this.audit.record({
      action: 'shipping.create',
      entityType: 'shipping_method',
      entityId: method.id,
      summary: method.name,
    });
    return toView(method);
  }

  async update(id: string, input: ShippingMethodUpsertInput): Promise<ShippingMethodView> {
    const existing = await this.prisma.shippingMethod.findUnique({ where: { id } });
    if (!existing) throw AppException.notFound('روش ارسال یافت نشد.');
    const method = await this.prisma.shippingMethod.update({
      where: { id },
      data: this.toData(input),
    });
    await this.audit.record({
      action: 'shipping.update',
      entityType: 'shipping_method',
      entityId: id,
      summary: method.name,
      before: {
        baseCost: existing.baseCost,
        isActive: existing.isActive,
        freeShippingThreshold: existing.freeShippingThreshold,
      },
      after: {
        baseCost: method.baseCost,
        isActive: method.isActive,
        freeShippingThreshold: method.freeShippingThreshold,
      },
    });
    return toView(method);
  }

  private toData(input: ShippingMethodUpsertInput) {
    return {
      ...input,
      baseCost: BigInt(input.baseCost),
      freeShippingThreshold: input.freeShippingThreshold
        ? BigInt(input.freeShippingThreshold)
        : null,
    };
  }
}
