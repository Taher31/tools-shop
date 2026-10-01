import { Injectable } from '@nestjs/common';
import type { AttributeUpsertInput, AttributeView } from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { toAttributeView } from './categories.service';
import { TaxonomyService } from './taxonomy.service';

@Injectable()
export class AttributesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async list(): Promise<(AttributeView & { usage: { categories: number; products: number } })[]> {
    const [taxonomy, usage] = await Promise.all([
      this.taxonomy.get(),
      this.prisma.attribute.findMany({
        select: { id: true, _count: { select: { categories: true, values: true } } },
      }),
    ]);
    const usageById = new Map(usage.map((u) => [u.id, u._count]));
    return taxonomy.snapshot.attributes.map((attribute) => ({
      ...toAttributeView(attribute),
      usage: {
        categories: usageById.get(attribute.id)?.categories ?? 0,
        products: usageById.get(attribute.id)?.values ?? 0,
      },
    }));
  }

  async create(input: AttributeUpsertInput): Promise<AttributeView> {
    if (await this.prisma.attribute.findUnique({ where: { code: input.code } })) {
      throw AppException.conflict('این کد ویژگی قبلاً استفاده شده است.', [
        { path: 'code', message: 'تکراری' },
      ]);
    }
    const { options, ...data } = input;
    const attribute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attribute.create({
        data: { ...data, options: { create: options } },
      });
      await this.audit.record(
        {
          action: 'attribute.create',
          entityType: 'attribute',
          entityId: created.id,
          summary: `ایجاد ویژگی ${created.name}`,
        },
        tx,
      );
      return created;
    });
    await this.taxonomy.invalidate();
    return this.getOrThrow(attribute.id);
  }

  async update(id: string, input: AttributeUpsertInput): Promise<AttributeView> {
    const existing = await this.prisma.attribute.findUnique({
      where: { id },
      include: { options: true, _count: { select: { values: true } } },
    });
    if (!existing) throw AppException.notFound('ویژگی یافت نشد.');
    if (existing._count.values > 0 && existing.type !== input.type) {
      throw AppException.conflict('نوع ویژگی‌ای که برای محصولات مقدار دارد قابل تغییر نیست.');
    }
    if (
      existing.code !== input.code &&
      (await this.prisma.attribute.findUnique({ where: { code: input.code } }))
    ) {
      throw AppException.conflict('این کد ویژگی قبلاً استفاده شده است.', [
        { path: 'code', message: 'تکراری' },
      ]);
    }
    const removed = existing.options
      .filter((o) => !input.options.some((n) => n.value === o.value))
      .map((o) => o.value);
    if (removed.length > 0) {
      const inUse = await this.prisma.productAttributeValue.count({
        where: { attributeId: id, optionValues: { hasSome: removed } },
      });
      if (inUse > 0) {
        throw AppException.conflict(
          `گزینه‌های ${removed.join('، ')} در محصولات استفاده شده‌اند و قابل حذف نیستند.`,
        );
      }
    }

    const { options, ...data } = input;
    await this.prisma.$transaction(async (tx) => {
      await tx.attribute.update({ where: { id }, data });
      await tx.attributeOption.deleteMany({
        where: { attributeId: id, value: { notIn: options.map((o) => o.value) } },
      });
      for (const option of options) {
        await tx.attributeOption.upsert({
          where: { attributeId_value: { attributeId: id, value: option.value } },
          update: { label: option.label, sortOrder: option.sortOrder },
          create: { ...option, attributeId: id },
        });
      }
      await this.audit.record(
        {
          action: 'attribute.update',
          entityType: 'attribute',
          entityId: id,
          summary: `ویرایش ویژگی ${input.name}`,
          before: {
            name: existing.name,
            code: existing.code,
            isFilterable: existing.isFilterable,
            unit: existing.unit,
          },
          after: {
            name: input.name,
            code: input.code,
            isFilterable: input.isFilterable,
            unit: input.unit,
          },
        },
        tx,
      );
      await this.outbox.record(tx, [
        {
          type: 'catalog.taxonomy_changed',
          aggregateType: 'attribute',
          aggregateId: id,
          payload: { attributeIds: [id] },
        },
      ]);
    });
    await this.taxonomy.invalidate();
    this.outbox.flush();
    return this.getOrThrow(id);
  }

  async remove(id: string): Promise<void> {
    const attribute = await this.prisma.attribute.findUnique({
      where: { id },
      include: { _count: { select: { values: true } } },
    });
    if (!attribute) throw AppException.notFound('ویژگی یافت نشد.');
    if (attribute._count.values > 0) {
      throw AppException.conflict('این ویژگی برای محصولات مقدار دارد؛ ابتدا مقادیر را حذف کنید.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.attribute.delete({ where: { id } });
      await this.audit.record(
        {
          action: 'attribute.delete',
          entityType: 'attribute',
          entityId: id,
          summary: `حذف ویژگی ${attribute.name}`,
        },
        tx,
      );
    });
    await this.taxonomy.invalidate();
  }

  private async getOrThrow(id: string): Promise<AttributeView> {
    const attribute = (await this.taxonomy.get()).attributesById.get(id);
    if (!attribute) throw AppException.notFound();
    return toAttributeView(attribute);
  }
}
