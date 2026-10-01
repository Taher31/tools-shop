import { Injectable } from '@nestjs/common';
import {
  type AdapterResult,
  IntegrationError,
  type MarketplaceAdapter,
  type UpsertResult,
} from './marketplace-adapter';

/**
 * Digikala Marketplace (seller panel) – push channel.
 *
 * TODO(phase-2-integration): implement once the official Digikala seller API
 * documentation and seller credentials are provided. Nothing here calls Digikala:
 * endpoints, authentication and payload formats must come from the official spec,
 * not from guesses. Expected work:
 *   1. authenticate with the seller credentials from the official docs;
 *   2. map MarketplaceProduct → Digikala variant (price/stock update per seller SKU);
 *   3. map Digikala error codes to IntegrationError messages;
 *   4. add contract tests against their sandbox.
 */
@Injectable()
export class DigikalaAdapter implements MarketplaceAdapter {
  readonly code = 'digikala';
  readonly name = 'دیجی‌کالا';
  readonly description = 'ارسال قیمت و موجودی کالاها به پنل فروشندگان دیجی‌کالا.';
  readonly kind = 'push' as const;
  readonly available = false;
  readonly notes =
    'نیازمند مستندات رسمی API فروشندگان دیجی‌کالا و اعتبارنامه فروشنده است. تا آن زمان این اتصال قابل فعال‌سازی نیست و هیچ درخواستی به دیجی‌کالا ارسال نمی‌شود.';
  readonly credentialFields = [
    { key: 'sellerId', label: 'شناسه فروشنده', secret: false, required: true },
    { key: 'apiToken', label: 'توکن API', secret: true, required: true },
  ];

  async testConnection(): Promise<AdapterResult> {
    return { ok: false, message: this.notes };
  }

  async upsertListing(): Promise<UpsertResult> {
    throw new IntegrationError(this.notes);
  }

  async removeListing(): Promise<void> {
    throw new IntegrationError(this.notes);
  }
}
