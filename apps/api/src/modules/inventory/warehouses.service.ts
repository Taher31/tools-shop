import { Injectable } from '@nestjs/common';
import type { Warehouse } from '@toolshop/database';
import type { WarehouseUpsertInput, WarehouseView } from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function toView(warehouse: Warehouse): WarehouseView {
  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    province: warehouse.province,
    city: warehouse.city,
    address: warehouse.address,
    phone: warehouse.phone,
    priority: warehouse.priority,
    isActive: warehouse.isActive,
    isDefault: warehouse.isDefault,
  };
}

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<WarehouseView[]> {
    const warehouses = await this.prisma.warehouse.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return warehouses.map(toView);
  }

  async create(input: WarehouseUpsertInput): Promise<WarehouseView> {
    if (await this.prisma.warehouse.findUnique({ where: { code: input.code } })) {
      throw AppException.conflict('کد انبار تکراری است.', [{ path: 'code', message: 'تکراری' }]);
    }
    const warehouse = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault)
        await tx.warehouse.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      const created = await tx.warehouse.create({ data: input });
      await this.audit.record(
        {
          action: 'warehouse.create',
          entityType: 'warehouse',
          entityId: created.id,
          summary: `ایجاد انبار ${created.name}`,
        },
        tx,
      );
      return created;
    });
    return toView(warehouse);
  }

  async update(id: string, input: WarehouseUpsertInput): Promise<WarehouseView> {
    const existing = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!existing) throw AppException.notFound('انبار یافت نشد.');
    if (
      input.code !== existing.code &&
      (await this.prisma.warehouse.findUnique({ where: { code: input.code } }))
    ) {
      throw AppException.conflict('کد انبار تکراری است.', [{ path: 'code', message: 'تکراری' }]);
    }
    if (!input.isActive && existing.isActive) {
      const reserved = await this.prisma.inventoryLevel.aggregate({
        where: { warehouseId: id },
        _sum: { reserved: true },
      });
      if ((reserved._sum.reserved ?? 0) > 0) {
        throw AppException.conflict(
          'این انبار کالای رزروشده برای سفارش‌های در انتظار پرداخت دارد.',
        );
      }
    }
    const warehouse = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault && !existing.isDefault) {
        await tx.warehouse.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      const updated = await tx.warehouse.update({ where: { id }, data: input });
      await this.audit.record(
        {
          action: 'warehouse.update',
          entityType: 'warehouse',
          entityId: id,
          summary: `ویرایش انبار ${updated.name}`,
          before: { name: existing.name, isActive: existing.isActive, priority: existing.priority },
          after: { name: updated.name, isActive: updated.isActive, priority: updated.priority },
        },
        tx,
      );
      return updated;
    });
    return toView(warehouse);
  }
}
