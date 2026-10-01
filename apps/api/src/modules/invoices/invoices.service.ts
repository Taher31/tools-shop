import { Injectable } from '@nestjs/common';
import type { Invoice, Prisma } from '@toolshop/database';
import {
  type AddressSnapshot,
  type AdminInvoiceListQuery,
  type InvoiceLine,
  type InvoiceParty,
  type InvoiceSummary,
  type InvoiceView,
  numberToPersianWords,
  type OrderStatus,
  type Paginated,
  STOCK_COMMITTED_STATUSES,
  toEnglishDigits,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { toRial } from '../../common/utils/money';
import { paginate, paginationArgs } from '../../common/utils/pagination';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { buyerParty, creditNoteContent, sellerParty } from './invoice-builder';

const VIEW_INCLUDE = {
  order: { select: { orderNumber: true, userId: true } },
  saleInvoice: { select: { invoiceNumber: true } },
} satisfies Prisma.InvoiceInclude;

type InvoiceRecord = Prisma.InvoiceGetPayload<{ include: typeof VIEW_INCLUDE }>;

/** Orders that represent a completed sale and therefore must have a sale invoice. */
const INVOICEABLE: readonly OrderStatus[] = [...STOCK_COMMITTED_STATUSES, 'returned', 'refunded'];

function toSummary(invoice: InvoiceRecord): InvoiceSummary {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    type: invoice.type,
    orderId: invoice.orderId,
    orderNumber: invoice.order.orderNumber,
    buyerName: (invoice.buyer as unknown as InvoiceParty).name,
    total: toRial(invoice.total),
    issuedAt: invoice.issuedAt.toISOString(),
  };
}

function toView(invoice: InvoiceRecord): InvoiceView {
  const total = toRial(invoice.total);
  return {
    ...toSummary(invoice),
    saleInvoiceNumber: invoice.saleInvoice?.invoiceNumber ?? null,
    seller: invoice.seller as unknown as InvoiceParty,
    buyer: invoice.buyer as unknown as InvoiceParty,
    lines: invoice.lines as unknown as InvoiceLine[],
    subtotal: toRial(invoice.subtotal),
    discountTotal: toRial(invoice.discountTotal),
    shippingCost: toRial(invoice.shippingCost),
    taxTotal: toRial(invoice.taxTotal),
    taxIncluded: invoice.taxIncluded,
    totalInWords: `${numberToPersianWords(total)} ریال`,
    note: invoice.note,
  };
}

const json = (value: unknown) => value as Prisma.InputJsonValue;

/**
 * Sales documents. A sale invoice is issued in the same transaction that marks an
 * order paid, so every captured payment has exactly one invoice (enforced by a
 * partial unique index). Refunds produce credit notes instead of editing invoices.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  /** Idempotent: returns the existing sale invoice if one was already issued. */
  async issueSaleInvoice(
    tx: Tx,
    orderId: string,
    issuedById: string | null = null,
  ): Promise<Invoice> {
    const existing = await tx.invoice.findFirst({ where: { orderId, type: 'sale' } });
    if (existing) return existing;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: { orderBy: { id: 'asc' } },
        user: { select: { firstName: true, lastName: true, mobile: true, nationalCode: true } },
      },
    });
    const [store, legal] = await Promise.all([
      this.settings.get('store'),
      this.settings.get('legal'),
    ]);
    const lines: InvoiceLine[] = order.items.map((item) => ({
      title: item.variantTitle ? `${item.title} – ${item.variantTitle}` : item.title,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: toRial(item.unitPrice),
      total: toRial(item.total),
    }));
    return tx.invoice.create({
      data: {
        type: 'sale',
        orderId,
        seller: json(sellerParty(store, legal)),
        buyer: json(buyerParty(order.user, order.shippingAddress as Partial<AddressSnapshot>)),
        lines: json(lines),
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        shippingCost: order.shippingCost,
        taxTotal: order.taxTotal,
        taxIncluded: order.taxIncluded,
        total: order.total,
        issuedById,
      },
    });
  }

  /** Credit note for a refund; returns null when the order was never invoiced. */
  async issueCreditNote(
    tx: Tx,
    input: { orderId: string; paymentId: string; amount: number; reason: string | null },
  ): Promise<Invoice | null> {
    const sale = await tx.invoice.findFirst({ where: { orderId: input.orderId, type: 'sale' } });
    if (!sale) return null;
    const content = creditNoteContent(
      {
        lines: sale.lines as unknown as InvoiceLine[],
        subtotal: toRial(sale.subtotal),
        discountTotal: toRial(sale.discountTotal),
        shippingCost: toRial(sale.shippingCost),
        taxTotal: toRial(sale.taxTotal),
        total: toRial(sale.total),
      },
      input.amount,
      sale.invoiceNumber,
    );
    return tx.invoice.create({
      data: {
        type: 'credit_note',
        orderId: input.orderId,
        saleInvoiceId: sale.id,
        paymentId: input.paymentId,
        seller: sale.seller as Prisma.InputJsonValue,
        buyer: sale.buyer as Prisma.InputJsonValue,
        lines: json(content.lines),
        subtotal: BigInt(content.amounts.subtotal),
        discountTotal: BigInt(content.amounts.discountTotal),
        shippingCost: BigInt(content.amounts.shippingCost),
        taxTotal: BigInt(content.amounts.taxTotal),
        taxIncluded: sale.taxIncluded,
        total: BigInt(content.amounts.total),
        note: input.reason,
      },
    });
  }

  /* ------------------------------------------------------------ customer */

  async listForOrder(orderId: string, userId: string): Promise<InvoiceSummary[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: { orderId, order: { userId } },
      include: VIEW_INCLUDE,
      orderBy: { invoiceNumber: 'asc' },
    });
    return invoices.map(toSummary);
  }

  async getForCustomer(id: string, userId: string): Promise<InvoiceView> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, order: { userId } },
      include: VIEW_INCLUDE,
    });
    if (!invoice) throw AppException.notFound('فاکتور یافت نشد.');
    return toView(invoice);
  }

  /* --------------------------------------------------------------- staff */

  async list(query: AdminInvoiceListQuery): Promise<Paginated<InvoiceSummary>> {
    const where: Prisma.InvoiceWhereInput = { type: query.type };
    const digits = query.q ? toEnglishDigits(query.q.trim()) : '';
    if (/^\d{1,9}$/.test(digits)) {
      where.OR = [{ invoiceNumber: Number(digits) }, { order: { orderNumber: Number(digits) } }];
    } else if (query.q?.trim()) {
      where.order = { user: { lastName: { contains: query.q.trim(), mode: 'insensitive' } } };
    }
    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: VIEW_INCLUDE,
        orderBy: { invoiceNumber: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginate(invoices.map(toSummary), total, query);
  }

  async listForAdminOrder(orderId: string): Promise<InvoiceSummary[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: { orderId },
      include: VIEW_INCLUDE,
      orderBy: { invoiceNumber: 'asc' },
    });
    return invoices.map(toSummary);
  }

  async get(id: string): Promise<InvoiceView> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: VIEW_INCLUDE });
    if (!invoice) throw AppException.notFound('فاکتور یافت نشد.');
    return toView(invoice);
  }

  /** Issues the missing sale invoice for an order paid before invoicing existed. */
  async issueForOrder(orderId: string, actorId: string): Promise<InvoiceView> {
    const invoice = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, orderNumber: true },
      });
      if (!order) throw AppException.notFound('سفارش یافت نشد.');
      if (!INVOICEABLE.includes(order.status)) {
        throw AppException.conflict('فقط برای سفارش‌های پرداخت‌شده فاکتور صادر می‌شود.');
      }
      const existing = await tx.invoice.findFirst({ where: { orderId, type: 'sale' } });
      if (existing) return existing;
      const created = await this.issueSaleInvoice(tx, orderId, actorId);
      await this.audit.record(
        {
          action: 'invoice.issue',
          entityType: 'invoice',
          entityId: created.id,
          summary: `صدور فاکتور ${created.invoiceNumber} برای سفارش ${order.orderNumber}`,
        },
        tx,
      );
      return created;
    });
    return this.get(invoice.id);
  }
}
