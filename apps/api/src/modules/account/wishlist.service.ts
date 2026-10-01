import { Injectable } from '@nestjs/common';
import type { WishlistItem } from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ProductQueryService } from '../catalog/products/product-query.service';

const MAX_ITEMS = 200;

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductQueryService,
  ) {}

  async list(userId: string): Promise<WishlistItem[]> {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const cards = await this.products.cardsByIds(items.map((item) => item.productId));
    const byId = new Map(cards.map((card) => [card.id, card]));
    return items.flatMap((item) => {
      const product = byId.get(item.productId);
      return product
        ? [{ productId: item.productId, addedAt: item.createdAt.toISOString(), product }]
        : [];
    });
  }

  async ids(userId: string): Promise<string[]> {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      select: { productId: true },
    });
    return items.map((item) => item.productId);
  }

  async add(userId: string, productId: string): Promise<string[]> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: 'active', deletedAt: null },
    });
    if (!product) throw AppException.notFound('محصول یافت نشد.');
    if ((await this.prisma.wishlistItem.count({ where: { userId } })) >= MAX_ITEMS) {
      throw AppException.conflict('فهرست علاقه‌مندی‌ها پر است.');
    }
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
    return this.ids(userId);
  }

  async remove(userId: string, productId: string): Promise<string[]> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return this.ids(userId);
  }
}
