/** Product as sent to (or read by) an external channel. Amounts in Rial. */
export interface MarketplaceProduct {
  productId: string;
  sku: string;
  title: string;
  brand: string | null;
  categoryPath: string[];
  url: string;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  availableQuantity: number;
  inStock: boolean;
}

export interface CredentialField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
}

export type Credentials = Record<string, string>;

export interface AdapterResult {
  ok: boolean;
  message: string;
}

export interface UpsertResult {
  externalId: string;
}

/**
 * Contract for every external sales channel (marketplaces, price comparison sites).
 *
 * - `push` adapters send product, price and stock changes to the channel's API.
 * - `pull` adapters expose our data (a product feed) that the channel reads.
 *
 * Adapters only translate; IntegrationsService owns credentials, queues, listing state
 * and logging, so adding a channel never touches catalog or order code.
 */
export interface MarketplaceAdapter {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly kind: 'push' | 'pull';
  /** False while the official API specification/credentials are not available. */
  readonly available: boolean;
  readonly notes: string;
  readonly credentialFields: CredentialField[];
  testConnection(credentials: Credentials): Promise<AdapterResult>;
  /** push only */
  upsertListing?(
    product: MarketplaceProduct,
    credentials: Credentials,
    externalId: string | null,
  ): Promise<UpsertResult>;
  /** push only */
  removeListing?(externalId: string, credentials: Credentials): Promise<void>;
  /** pull only: one item of the public feed. */
  toFeedItem?(product: MarketplaceProduct): Record<string, unknown>;
}

export const MARKETPLACE_ADAPTERS = Symbol('MARKETPLACE_ADAPTERS');

/** Thrown by adapters for errors worth showing to staff (wrong token, rejected item, ...). */
export class IntegrationError extends Error {}
