import { Injectable } from '@nestjs/common';
import type { AdapterResult, MarketplaceAdapter, MarketplaceProduct } from './marketplace-adapter';

/**
 * Torob (price comparison) – pull channel: Torob reads products from the store.
 *
 * We expose a token-protected JSON feed of visible products with live price and
 * availability (GET /api/v1/feeds/torob?token=...). The field names below are our own
 * generic format. TODO(phase-2-integration): before submitting the feed, align the
 * format with Torob's official merchant documentation (field names, units, paging) –
 * only `toFeedItem` needs to change.
 */
@Injectable()
export class TorobAdapter implements MarketplaceAdapter {
  readonly code = 'torob';
  readonly name = 'ترب';
  readonly description = 'فید محصولات (قیمت و موجودی لحظه‌ای) برای خوانده‌شدن توسط ترب.';
  readonly kind = 'pull' as const;
  readonly available = true;
  readonly notes =
    'فید با قالب عمومی فروشگاه ساخته می‌شود. پیش از معرفی به ترب، قالب فیلدها باید با مستندات رسمی ترب برای فروشگاه‌ها تطبیق داده شود.';
  readonly credentialFields = [
    { key: 'feedToken', label: 'توکن دسترسی فید (حداقل ۲۴ کاراکتر)', secret: true, required: true },
  ];

  async testConnection(credentials: Record<string, string>): Promise<AdapterResult> {
    const token = credentials['feedToken'] ?? '';
    return token.length >= 24
      ? { ok: true, message: 'فید آماده است.' }
      : { ok: false, message: 'توکن فید باید حداقل ۲۴ کاراکتر باشد.' };
  }

  toFeedItem(product: MarketplaceProduct): Record<string, unknown> {
    return {
      id: product.productId,
      sku: product.sku,
      title: product.title,
      brand: product.brand,
      category: product.categoryPath.join(' > '),
      url: product.url,
      image: product.imageUrl,
      price_rial: product.price,
      old_price_rial: product.compareAtPrice,
      availability: product.inStock ? 'instock' : 'outofstock',
    };
  }
}
