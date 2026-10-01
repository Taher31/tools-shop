import { Injectable } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import {
  type AddCartItemInput,
  type CartLine,
  type CartLineIssue,
  type CartView,
  MAX_CART_LINE_QUANTITY,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { sha256 } from '../../common/utils/crypto';
import { toRial } from '../../common/utils/money';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { ACTIVE_LEVELS_SELECT, parseVariantOptions } from '../catalog/product-card';
import { TaxonomyService } from '../catalog/taxonomy.service';
import { CouponsService } from '../coupons/coupons.service';
import { availableQuantity } from '../inventory/stock';
import {
  calculateTotals,
  type CouponRule,
  type PricingResult,
  type ShippingRule,
} from '../pricing/pricing';
import { SettingsService } from '../settings/settings.service';

export interface CartIdentity {
  userId?: string;
  guestToken?: string;
}

export const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              deletedAt: true,
              categoryId: true,
              images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
            },
          },
          inventoryLevels: ACTIVE_LEVELS_SELECT,
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export type CartRecord = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>;

export interface PricedCart {
  cart: CartRecord;
  view: CartView;
  pricing: PricingResult;
  coupon: { rule: CouponRule; couponId: string; description: string | null } | null;
  /** Lines that can be ordered (no issue), in cart order. */
  orderableLines: { line: CartLine; record: CartRecord['items'][number] }[];
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly coupons: CouponsService,
    private readonly settings: SettingsService,
  ) {}

  async view(identity: CartIdentity): Promise<CartView> {
    const cart = await this.find(identity);
    return cart ? (await this.price(cart, identity.userId)).view : this.emptyView();
  }

  async addItem(identity: CartIdentity, input: AddCartItemInput): Promise<CartView> {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: input.variantId,
        isActive: true,
        deletedAt: null,
        product: { status: 'active', deletedAt: null },
      },
      include: { inventoryLevels: ACTIVE_LEVELS_SELECT, product: { select: { title: true } } },
    });
    if (!variant) throw AppException.notFound('این کالا در حال حاضر قابل خرید نیست.');

    const cart = await this.findOrCreate(identity);
    const existing = cart.items.find((item) => item.variantId === input.variantId);
    const quantity = Math.min(MAX_CART_LINE_QUANTITY, (existing?.quantity ?? 0) + input.quantity);
    const available = availableQuantity(variant.inventoryLevels);
    if (available <= 0)
      throw new AppException('OUT_OF_STOCK', `${variant.product.title} موجود نیست.`);
    if (quantity > available) {
      throw new AppException(
        'OUT_OF_STOCK',
        `از ${variant.product.title} فقط ${available} عدد موجود است.`,
      );
    }
    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: input.variantId } },
      update: { quantity },
      create: { cartId: cart.id, variantId: input.variantId, quantity },
    });
    return this.view(identity);
  }

  async updateItem(identity: CartIdentity, itemId: string, quantity: number): Promise<CartView> {
    const cart = await this.requireCart(identity);
    const item = cart.items.find((entry) => entry.id === itemId);
    if (!item) throw AppException.notFound('این کالا در سبد خرید شما نیست.');
    if (quantity === 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
      return this.view(identity);
    }
    const available = availableQuantity(item.variant.inventoryLevels);
    if (quantity > item.quantity && quantity > available) {
      throw new AppException(
        'OUT_OF_STOCK',
        `از ${item.variant.product.title} فقط ${available} عدد موجود است.`,
      );
    }
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.view(identity);
  }

  async removeItem(identity: CartIdentity, itemId: string): Promise<CartView> {
    const cart = await this.requireCart(identity);
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    return this.view(identity);
  }

  async applyCoupon(identity: CartIdentity, code: string): Promise<CartView> {
    const cart = await this.requireCart(identity);
    const resolution = await this.coupons.resolve(code, identity.userId);
    if (!resolution.rule) throw new AppException('INVALID_COUPON', resolution.error ?? undefined);
    const priced = await this.price({ ...cart, couponCode: resolution.rule.code }, identity.userId);
    if (priced.pricing.couponError)
      throw new AppException('INVALID_COUPON', priced.pricing.couponError);
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: resolution.rule.code },
    });
    return this.view(identity);
  }

  async removeCoupon(identity: CartIdentity): Promise<CartView> {
    const cart = await this.find(identity);
    if (cart) await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    return this.view(identity);
  }

  /** On login/registration the guest cart is folded into the customer's cart. */
  async mergeGuestCartIntoUser(guestToken: string, userId: string): Promise<void> {
    const guest = await this.prisma.cart.findUnique({
      where: { tokenHash: sha256(guestToken) },
      include: { items: true },
    });
    if (!guest) return;
    await this.prisma.$transaction(async (tx) => {
      const userCart =
        (await tx.cart.findUnique({ where: { userId }, include: { items: true } })) ??
        (await tx.cart.create({ data: { userId }, include: { items: true } }));
      for (const item of guest.items) {
        const current = userCart.items.find((existing) => existing.variantId === item.variantId);
        const quantity = Math.min(MAX_CART_LINE_QUANTITY, (current?.quantity ?? 0) + item.quantity);
        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
          update: { quantity },
          create: { cartId: userCart.id, variantId: item.variantId, quantity },
        });
      }
      if (!userCart.couponCode && guest.couponCode) {
        await tx.cart.update({
          where: { id: userCart.id },
          data: { couponCode: guest.couponCode },
        });
      }
      await tx.cart.delete({ where: { id: guest.id } });
    });
  }

  async clear(tx: Tx, cartId: string): Promise<void> {
    await tx.cartItem.deleteMany({ where: { cartId } });
    await tx.cart.update({ where: { id: cartId }, data: { couponCode: null } });
  }

  async find(
    identity: CartIdentity,
    client: Tx | PrismaService = this.prisma,
  ): Promise<CartRecord | null> {
    if (identity.userId)
      return client.cart.findUnique({ where: { userId: identity.userId }, include: CART_INCLUDE });
    if (identity.guestToken) {
      return client.cart.findUnique({
        where: { tokenHash: sha256(identity.guestToken) },
        include: CART_INCLUDE,
      });
    }
    return null;
  }

  /**
   * Re-prices the cart from live catalog data. `shipping` is added at checkout once the
   * customer picks a method. Invalid coupons are dropped with a warning.
   */
  async price(
    cart: CartRecord,
    userId: string | undefined,
    options: { shipping?: ShippingRule | null; client?: Tx | PrismaService } = {},
  ): Promise<PricedCart> {
    const taxonomy = await this.taxonomy.get();
    const commerce = await this.settings.get('commerce');
    const warnings: string[] = [];

    const lines = cart.items.map((item) => {
      const { variant } = item;
      const visible =
        variant.isActive &&
        !variant.deletedAt &&
        variant.product.status === 'active' &&
        !variant.product.deletedAt &&
        taxonomy.isCategoryVisible(variant.product.categoryId);
      const available = availableQuantity(variant.inventoryLevels);
      let issue: CartLineIssue | null = null;
      if (!visible) issue = 'unavailable';
      else if (available <= 0) issue = 'out_of_stock';
      else if (item.quantity > available) issue = 'insufficient_stock';
      if (issue === 'unavailable') warnings.push(`«${variant.product.title}» دیگر قابل خرید نیست.`);
      if (issue === 'out_of_stock') warnings.push(`«${variant.product.title}» ناموجود شده است.`);
      if (issue === 'insufficient_stock') {
        warnings.push(`از «${variant.product.title}» فقط ${available} عدد موجود است.`);
      }
      const unitPrice = toRial(variant.price);
      const line: CartLine = {
        id: item.id,
        variantId: variant.id,
        productId: variant.product.id,
        productSlug: variant.product.slug,
        title: variant.product.title,
        variantTitle: variant.title,
        options: parseVariantOptions(variant.options),
        sku: variant.sku,
        imageUrl: variant.product.images[0]?.url ?? null,
        unitPrice,
        compareAtPrice: toRial(variant.compareAtPrice),
        quantity: item.quantity,
        lineTotal: unitPrice * item.quantity,
        availableQuantity: available,
        issue,
      };
      return { line, record: item };
    });

    const priceable = lines.filter(
      ({ line }) => line.issue !== 'unavailable' && line.issue !== 'out_of_stock',
    );
    let coupon: PricedCart['coupon'] = null;
    if (cart.couponCode) {
      const resolution = await this.coupons.resolve(cart.couponCode, userId, options.client);
      if (resolution.rule && resolution.couponId) {
        coupon = {
          rule: resolution.rule,
          couponId: resolution.couponId,
          description: resolution.description,
        };
      } else warnings.push(resolution.error ?? 'کد تخفیف معتبر نیست.');
    }

    const pricing = calculateTotals({
      lines: priceable.map(({ line }) => ({
        unitPrice: line.unitPrice,
        compareAtPrice: line.compareAtPrice,
        quantity: line.quantity,
      })),
      coupon: coupon?.rule,
      shipping: options.shipping,
      tax: { ratePercent: commerce.taxRatePercent, included: commerce.pricesIncludeTax },
    });
    if (pricing.couponError) warnings.push(pricing.couponError);
    const couponActive = coupon !== null && pricing.couponApplied;

    return {
      cart,
      pricing,
      coupon: couponActive ? coupon : null,
      orderableLines: lines.filter(({ line }) => line.issue === null),
      view: {
        id: cart.id,
        lines: lines.map(({ line }) => line),
        coupon:
          couponActive && coupon
            ? { code: coupon.rule.code, description: coupon.description }
            : null,
        totals: {
          itemsCount: pricing.itemsCount,
          subtotal: pricing.subtotal,
          productSavings: pricing.productSavings,
          couponDiscount: pricing.couponDiscount,
          shippingCost: pricing.shippingCost,
          tax: pricing.tax,
          taxIncluded: pricing.taxIncluded,
          total: pricing.total,
        },
        warnings,
      },
    };
  }

  private async findOrCreate(identity: CartIdentity): Promise<CartRecord> {
    const existing = await this.find(identity);
    if (existing) return existing;
    if (identity.userId)
      return this.prisma.cart.create({ data: { userId: identity.userId }, include: CART_INCLUDE });
    if (identity.guestToken) {
      return this.prisma.cart.create({
        data: { tokenHash: sha256(identity.guestToken) },
        include: CART_INCLUDE,
      });
    }
    throw new AppException('BAD_REQUEST', 'شناسه سبد خرید نامعتبر است.');
  }

  private async requireCart(identity: CartIdentity): Promise<CartRecord> {
    const cart = await this.find(identity);
    if (!cart) throw AppException.notFound('سبد خرید یافت نشد.');
    return cart;
  }

  private emptyView(): CartView {
    return {
      id: '',
      lines: [],
      coupon: null,
      totals: {
        itemsCount: 0,
        subtotal: 0,
        productSavings: 0,
        couponDiscount: 0,
        shippingCost: null,
        tax: 0,
        taxIncluded: true,
        total: 0,
      },
      warnings: [],
    };
  }
}
