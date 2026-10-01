import { Injectable } from '@nestjs/common';
import type { Prisma, StockMovementType } from '@toolshop/database';
import {
  type InventoryListQuery,
  type InventoryRow,
  type Paginated,
  type StockMovementListQuery,
  type StockMovementView,
  type StockOperationInput,
  type StockTransferInput,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { paginate, paginationArgs } from '../../common/utils/pagination';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { stockTotals } from './stock';

export interface ReservationLine {
  variantId: string;
  quantity: number;
  /** For error messages. */
  label?: string;
}

export class InsufficientStockError extends AppException {
  constructor(
    readonly variantId: string,
    readonly available: number,
    label?: string,
  ) {
    super(
      'OUT_OF_STOCK',
      available > 0
        ? `از ${label ?? 'این کالا'} فقط ${available} عدد موجود است.`
        : `${label ?? 'این کالا'} موجود نیست.`,
      [{ path: variantId, message: String(available) }],
    );
  }
}

interface LockedLevel {
  id: string;
  warehouseId: string;
  onHand: number;
  reserved: number;
}

/**
 * Inventory domain service. Every on-hand change writes an immutable StockMovement.
 * Concurrency: levels are locked with SELECT ... FOR UPDATE (variants in a stable
 * order to avoid deadlocks) and CHECK constraints guarantee 0 <= reserved <= onHand,
 * so two customers can never buy the last unit twice.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Reserves stock for an order, picking warehouses by priority (may split a line). */
  async reserve(tx: Tx, orderId: string, lines: ReservationLine[], expiresAt: Date): Promise<void> {
    const merged = new Map<string, ReservationLine>();
    for (const line of lines) {
      const existing = merged.get(line.variantId);
      merged.set(
        line.variantId,
        existing ? { ...existing, quantity: existing.quantity + line.quantity } : line,
      );
    }
    const ordered = [...merged.values()].sort((a, b) => a.variantId.localeCompare(b.variantId));

    for (const line of ordered) {
      const levels = await this.lockLevels(tx, line.variantId);
      const available = levels.reduce(
        (sum, level) => sum + Math.max(0, level.onHand - level.reserved),
        0,
      );
      if (available < line.quantity)
        throw new InsufficientStockError(line.variantId, available, line.label);

      let remaining = line.quantity;
      for (const level of levels) {
        if (remaining === 0) break;
        const take = Math.min(remaining, Math.max(0, level.onHand - level.reserved));
        if (take === 0) continue;
        await tx.inventoryLevel.update({
          where: { id: level.id },
          data: { reserved: { increment: take } },
        });
        await tx.stockReservation.create({
          data: {
            orderId,
            variantId: line.variantId,
            warehouseId: level.warehouseId,
            quantity: take,
            expiresAt,
          },
        });
        remaining -= take;
      }
    }
    await this.recordChanged(
      tx,
      ordered.map((l) => l.variantId),
    );
  }

  /** Payment captured: reserved units leave the warehouse (sale movements). */
  async commitReservations(tx: Tx, orderId: string, reference: string): Promise<void> {
    const reservations = await this.activeReservations(tx, orderId);
    for (const reservation of reservations) {
      const level = await tx.inventoryLevel.update({
        where: {
          variantId_warehouseId: {
            variantId: reservation.variantId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          onHand: { decrement: reservation.quantity },
          reserved: { decrement: reservation.quantity },
        },
      });
      await tx.stockMovement.create({
        data: {
          variantId: reservation.variantId,
          warehouseId: reservation.warehouseId,
          type: 'sale',
          quantity: -reservation.quantity,
          onHandAfter: level.onHand,
          orderId,
          reference,
        },
      });
      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { status: 'committed' },
      });
    }
    await this.recordChanged(
      tx,
      reservations.map((r) => r.variantId),
    );
  }

  /** Unpaid order cancelled or expired: reserved units become available again. */
  async releaseReservations(
    tx: Tx,
    orderId: string,
    status: 'released' | 'expired',
  ): Promise<void> {
    const reservations = await this.activeReservations(tx, orderId);
    for (const reservation of reservations) {
      await tx.inventoryLevel.update({
        where: {
          variantId_warehouseId: {
            variantId: reservation.variantId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reserved: { decrement: reservation.quantity } },
      });
      await tx.stockReservation.update({ where: { id: reservation.id }, data: { status } });
    }
    await this.recordChanged(
      tx,
      reservations.map((r) => r.variantId),
    );
  }

  /** Paid order cancelled or returned: units go back to the warehouses they left. */
  async restockOrder(
    tx: Tx,
    orderId: string,
    type: 'cancellation' | 'return',
    reference: string,
  ): Promise<void> {
    const committed = await tx.stockReservation.findMany({
      where: { orderId, status: 'committed' },
    });
    for (const reservation of committed) {
      const level = await tx.inventoryLevel.update({
        where: {
          variantId_warehouseId: {
            variantId: reservation.variantId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { onHand: { increment: reservation.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          variantId: reservation.variantId,
          warehouseId: reservation.warehouseId,
          type,
          quantity: reservation.quantity,
          onHandAfter: level.onHand,
          orderId,
          reference,
        },
      });
      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { status: 'released' },
      });
    }
    await this.recordChanged(
      tx,
      committed.map((r) => r.variantId),
    );
  }

  /** Staff stock operation (goods received, customer return, count correction). */
  async applyOperation(input: StockOperationInput, actorId: string): Promise<InventoryRow> {
    await this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findFirst({
        where: { id: input.variantId, deletedAt: null },
        include: { product: { select: { title: true } } },
      });
      if (!variant) throw AppException.notFound('تنوع محصول یافت نشد.');
      const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId } });
      if (!warehouse) throw AppException.notFound('انبار یافت نشد.');

      await tx.inventoryLevel.upsert({
        where: {
          variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
        },
        update: {},
        create: { variantId: input.variantId, warehouseId: input.warehouseId },
      });
      const [level] = await this.lockLevels(tx, input.variantId, input.warehouseId);
      if (!level) throw AppException.notFound();

      const delta = input.type === 'set' ? input.quantity - level.onHand : input.quantity;
      if (delta === 0) return;
      const nextOnHand = level.onHand + delta;
      if (nextOnHand < level.reserved) {
        throw AppException.conflict(
          `موجودی نمی‌تواند کمتر از تعداد رزروشده برای سفارش‌های در انتظار پرداخت (${level.reserved}) باشد.`,
        );
      }
      const movementType: StockMovementType = input.type === 'set' ? 'adjustment' : input.type;
      await tx.inventoryLevel.update({ where: { id: level.id }, data: { onHand: nextOnHand } });
      await tx.stockMovement.create({
        data: {
          variantId: input.variantId,
          warehouseId: input.warehouseId,
          type: movementType,
          quantity: delta,
          onHandAfter: nextOnHand,
          reference: input.reference,
          note: input.note,
          actorId,
        },
      });
      await this.audit.record(
        {
          action: 'inventory.update',
          entityType: 'variant',
          entityId: input.variantId,
          summary: `${movementType} ${variant.sku} در ${warehouse.name}: ${delta > 0 ? '+' : ''}${delta}`,
          before: { onHand: level.onHand, warehouse: warehouse.code },
          after: { onHand: nextOnHand, warehouse: warehouse.code, note: input.note },
        },
        tx,
      );
      await this.recordChanged(tx, [input.variantId]);
    });
    this.outbox.flush();
    return this.row(input.variantId);
  }

  async transfer(input: StockTransferInput, actorId: string): Promise<InventoryRow> {
    await this.prisma.$transaction(async (tx) => {
      const warehouses = await tx.warehouse.findMany({
        where: { id: { in: [input.fromWarehouseId, input.toWarehouseId] } },
      });
      if (warehouses.length !== 2) throw AppException.notFound('انبار یافت نشد.');
      await tx.inventoryLevel.upsert({
        where: {
          variantId_warehouseId: { variantId: input.variantId, warehouseId: input.toWarehouseId },
        },
        update: {},
        create: { variantId: input.variantId, warehouseId: input.toWarehouseId },
      });
      const levels = await this.lockLevels(tx, input.variantId);
      const from = levels.find((l) => l.warehouseId === input.fromWarehouseId);
      const to = levels.find((l) => l.warehouseId === input.toWarehouseId);
      if (!from || !to) throw AppException.notFound('موجودی انبار مبدا یافت نشد.');
      const available = from.onHand - from.reserved;
      if (available < input.quantity) {
        throw AppException.conflict(`موجودی قابل انتقال در انبار مبدا ${available} عدد است.`);
      }
      const reference = `TRANSFER-${Date.now()}`;
      await tx.inventoryLevel.update({
        where: { id: from.id },
        data: { onHand: from.onHand - input.quantity },
      });
      await tx.inventoryLevel.update({
        where: { id: to.id },
        data: { onHand: to.onHand + input.quantity },
      });
      await tx.stockMovement.createMany({
        data: [
          {
            variantId: input.variantId,
            warehouseId: from.warehouseId,
            type: 'transfer_out',
            quantity: -input.quantity,
            onHandAfter: from.onHand - input.quantity,
            reference,
            note: input.note,
            actorId,
          },
          {
            variantId: input.variantId,
            warehouseId: to.warehouseId,
            type: 'transfer_in',
            quantity: input.quantity,
            onHandAfter: to.onHand + input.quantity,
            reference,
            note: input.note,
            actorId,
          },
        ],
      });
      await this.audit.record(
        {
          action: 'inventory.transfer',
          entityType: 'variant',
          entityId: input.variantId,
          summary: `انتقال ${input.quantity} عدد بین انبارها`,
          after: { from: from.warehouseId, to: to.warehouseId, quantity: input.quantity },
        },
        tx,
      );
      await this.recordChanged(tx, [input.variantId]);
    });
    this.outbox.flush();
    return this.row(input.variantId);
  }

  async list(query: InventoryListQuery): Promise<Paginated<InventoryRow>> {
    const where: Prisma.ProductVariantWhereInput = {
      deletedAt: null,
      product: { deletedAt: null },
    };
    if (query.q) {
      where.OR = [
        { sku: { contains: query.q.toUpperCase() } },
        { barcode: query.q },
        { product: { title: { contains: query.q, mode: 'insensitive' } } },
      ];
    }
    if (query.lowStock) where.id = { in: await this.lowStockVariantIds() };
    if (query.warehouseId) where.inventoryLevels = { some: { warehouseId: query.warehouseId } };

    const [variants, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where,
        include: ROW_INCLUDE,
        orderBy: [{ product: { title: 'asc' } }, { sortOrder: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.productVariant.count({ where }),
    ]);
    return paginate(variants.map(toInventoryRow), total, query);
  }

  async lowStock(limit: number): Promise<InventoryRow[]> {
    const ids = await this.lowStockVariantIds();
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: ids.slice(0, limit) } },
      include: ROW_INCLUDE,
    });
    return variants.map(toInventoryRow).sort((a, b) => a.available - b.available);
  }

  async countLowStock(): Promise<number> {
    return (await this.lowStockVariantIds()).length;
  }

  async movements(query: StockMovementListQuery): Promise<Paginated<StockMovementView>> {
    const where: Prisma.StockMovementWhereInput = {
      variantId: query.variantId,
      warehouseId: query.warehouseId,
      type: query.type,
      ...(query.q
        ? {
            OR: [
              { variant: { sku: { contains: query.q.toUpperCase() } } },
              { reference: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          variant: { select: { sku: true, product: { select: { title: true } } } },
          warehouse: { select: { name: true } },
          actor: { select: { firstName: true, lastName: true } },
        },
        ...paginationArgs(query),
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return paginate(
      rows.map((row) => ({
        id: row.id,
        type: row.type,
        quantity: row.quantity,
        onHandAfter: row.onHandAfter,
        sku: row.variant.sku,
        productTitle: row.variant.product.title,
        warehouseName: row.warehouse.name,
        reference: row.reference,
        note: row.note,
        actorName: row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : null,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  async row(variantId: string): Promise<InventoryRow> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: ROW_INCLUDE,
    });
    if (!variant) throw AppException.notFound();
    return toInventoryRow(variant);
  }

  /** Locks the variant's levels in active warehouses ordered by warehouse priority. */
  private lockLevels(tx: Tx, variantId: string, warehouseId?: string): Promise<LockedLevel[]> {
    return warehouseId
      ? tx.$queryRaw<LockedLevel[]>`
          SELECT l."id", l."warehouseId", l."onHand", l."reserved"
          FROM "InventoryLevel" l
          WHERE l."variantId" = ${variantId}::uuid AND l."warehouseId" = ${warehouseId}::uuid
          FOR UPDATE`
      : tx.$queryRaw<LockedLevel[]>`
          SELECT l."id", l."warehouseId", l."onHand", l."reserved"
          FROM "InventoryLevel" l
          JOIN "Warehouse" w ON w."id" = l."warehouseId"
          WHERE l."variantId" = ${variantId}::uuid AND w."isActive"
          ORDER BY w."priority" ASC, w."createdAt" ASC
          FOR UPDATE OF l`;
  }

  private activeReservations(tx: Tx, orderId: string) {
    return tx.stockReservation.findMany({
      where: { orderId, status: 'active' },
      orderBy: { variantId: 'asc' },
    });
  }

  private async recordChanged(tx: Tx, variantIds: string[]): Promise<void> {
    if (variantIds.length === 0) return;
    const unique = [...new Set(variantIds)];
    const variants = await tx.productVariant.findMany({
      where: { id: { in: unique } },
      select: { productId: true },
    });
    const productIds = [...new Set(variants.map((v) => v.productId))];
    await this.outbox.record(tx, [
      {
        type: 'inventory.changed',
        aggregateType: 'variant',
        aggregateId: unique[0] as string,
        payload: { productIds, variantIds: unique },
      },
    ]);
  }

  private async lowStockVariantIds(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT v."id"
      FROM "ProductVariant" v
      JOIN "Product" p ON p."id" = v."productId" AND p."deletedAt" IS NULL
      LEFT JOIN "InventoryLevel" l ON l."variantId" = v."id"
      LEFT JOIN "Warehouse" w ON w."id" = l."warehouseId" AND w."isActive"
      WHERE v."deletedAt" IS NULL AND v."isActive"
      GROUP BY v."id", v."lowStockThreshold"
      HAVING COALESCE(SUM(CASE WHEN w."id" IS NULL THEN 0 ELSE GREATEST(l."onHand" - l."reserved", 0) END), 0) <= v."lowStockThreshold"
      ORDER BY COALESCE(SUM(CASE WHEN w."id" IS NULL THEN 0 ELSE GREATEST(l."onHand" - l."reserved", 0) END), 0) ASC`;
    return rows.map((row) => row.id);
  }
}

const ROW_INCLUDE = {
  product: { select: { id: true, title: true } },
  inventoryLevels: {
    include: { warehouse: { select: { id: true, code: true, name: true, isActive: true } } },
  },
} satisfies Prisma.ProductVariantInclude;

type RowRecord = Prisma.ProductVariantGetPayload<{ include: typeof ROW_INCLUDE }>;

function toInventoryRow(variant: RowRecord): InventoryRow {
  const activeLevels = variant.inventoryLevels.filter((level) => level.warehouse.isActive);
  const totals = stockTotals(activeLevels);
  return {
    variantId: variant.id,
    productId: variant.product.id,
    productTitle: variant.product.title,
    variantTitle: variant.title,
    sku: variant.sku,
    lowStockThreshold: variant.lowStockThreshold,
    ...totals,
    isLowStock: totals.available <= variant.lowStockThreshold,
    levels: variant.inventoryLevels.map((level) => ({
      warehouseId: level.warehouse.id,
      warehouseCode: level.warehouse.code,
      warehouseName: level.warehouse.name,
      onHand: level.onHand,
      reserved: level.reserved,
      available: Math.max(0, level.onHand - level.reserved),
    })),
  };
}
