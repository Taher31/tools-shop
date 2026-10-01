import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../../infrastructure/redis/redis.constants';
import {
  type AdapterResult,
  type Credentials,
  IntegrationError,
  type MarketplaceAdapter,
  type MarketplaceProduct,
  type UpsertResult,
} from './marketplace-adapter';

const key = (externalId: string) => `mockmarket:${externalId}`;

/**
 * Development marketplace that behaves like a real push API (auth check, upsert,
 * delete, rejections) so the whole sync pipeline can be exercised without contracts.
 * Listings are kept in Redis for a week.
 */
@Injectable()
export class MockMarketplaceAdapter implements MarketplaceAdapter {
  readonly code = 'mock_marketplace';
  readonly name = 'مارکت‌پلیس آزمایشی';
  readonly description = 'شبیه‌ساز یک مارکت‌پلیس برای آزمودن همگام‌سازی محصول، قیمت و موجودی.';
  readonly kind = 'push' as const;
  readonly available = true;
  readonly notes = 'فقط برای توسعه و آزمون. هر کلید API غیر از «invalid» پذیرفته می‌شود.';
  readonly credentialFields = [
    { key: 'apiKey', label: 'کلید API', secret: true, required: true },
    { key: 'shopId', label: 'شناسه فروشگاه', secret: false, required: false },
  ];

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async testConnection(credentials: Credentials): Promise<AdapterResult> {
    if (credentials['apiKey'] === 'invalid')
      return { ok: false, message: 'کلید API توسط مارکت‌پلیس رد شد.' };
    return { ok: true, message: 'اتصال برقرار است.' };
  }

  async upsertListing(
    product: MarketplaceProduct,
    credentials: Credentials,
    externalId: string | null,
  ): Promise<UpsertResult> {
    if (credentials['apiKey'] === 'invalid') throw new IntegrationError('کلید API نامعتبر است.');
    if (product.price <= 0) throw new IntegrationError('قیمت کالا باید بیشتر از صفر باشد.');
    const id = externalId ?? `MOCK-${product.productId.slice(-12).toUpperCase()}`;
    await this.redis.set(key(id), JSON.stringify(product), 'EX', 7 * 86_400);
    return { externalId: id };
  }

  async removeListing(externalId: string): Promise<void> {
    await this.redis.del(key(externalId));
  }

  /** Test/diagnostic helper: what the fake marketplace currently holds. */
  async stored(externalId: string): Promise<MarketplaceProduct | null> {
    const raw = await this.redis.get(key(externalId));
    return raw ? (JSON.parse(raw) as MarketplaceProduct) : null;
  }
}
