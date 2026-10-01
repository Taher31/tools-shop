import type {
  CartView,
  CheckoutPreview,
  CheckoutResult,
  InventoryRow,
  ProductDetail,
  WarehouseView,
} from '@toolshop/shared';
import type { Response } from 'supertest';
import { type Agent, API } from './app';

/** Fails the test with the API's error body instead of a bare status code. */
export function ok<T>(response: Response): T {
  if (response.status >= 400) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.body)}`);
  }
  return response.body as T;
}

export async function variantOf(
  agent: Agent,
  productSlug: string,
  index = 0,
): Promise<ProductDetail['variants'][number]> {
  const product = ok<ProductDetail>(await agent.get(`${API}/products/${productSlug}`));
  const variant = product.variants[index];
  if (!variant) throw new Error(`Product ${productSlug} has no variant #${index}`);
  return variant;
}

export async function inventoryOf(admin: Agent, variantId: string): Promise<InventoryRow> {
  return ok<InventoryRow>(await admin.get(`${API}/admin/inventory/variants/${variantId}`));
}

/** Sets on-hand quantities per warehouse code (other warehouses are left untouched). */
export async function setStock(
  admin: Agent,
  variantId: string,
  quantities: Record<string, number>,
): Promise<InventoryRow> {
  const warehouses = ok<WarehouseView[]>(await admin.get(`${API}/admin/warehouses`));
  let row: InventoryRow | undefined;
  for (const [code, quantity] of Object.entries(quantities)) {
    const warehouse = warehouses.find((w) => w.code === code);
    if (!warehouse) throw new Error(`Unknown warehouse ${code}`);
    row = ok<InventoryRow>(
      await admin.post(`${API}/admin/inventory/operations`).send({
        variantId,
        warehouseId: warehouse.id,
        type: 'set',
        quantity,
        note: 'تنظیم برای آزمون',
      }),
    );
  }
  if (!row) throw new Error('No quantities given');
  return row;
}

export function levelOf(row: InventoryRow, code: string): { onHand: number; reserved: number } {
  const level = row.levels.find((l) => l.warehouseCode === code);
  return { onHand: level?.onHand ?? 0, reserved: level?.reserved ?? 0 };
}

export async function addToCart(
  agent: Agent,
  variantId: string,
  quantity: number,
): Promise<CartView> {
  return ok<CartView>(await agent.post(`${API}/cart/items`).send({ variantId, quantity }));
}

export interface CheckoutContext {
  addressId: string;
  shippingMethodId: string;
  total: number;
}

/** Loads the checkout page and quotes the cheapest shipping option, like the storefront does. */
export async function prepareCheckout(agent: Agent, addressId: string): Promise<CheckoutContext> {
  const preview = ok<CheckoutPreview>(await agent.get(`${API}/checkout`));
  const shipping = [...preview.shippingOptions].sort((a, b) => a.cost - b.cost)[0];
  if (!shipping) throw new Error('No shipping option available');
  const quote = ok<{ total: number }>(
    await agent.post(`${API}/checkout/quote`).send({ addressId, shippingMethodId: shipping.id }),
  );
  return { addressId, shippingMethodId: shipping.id, total: quote.total };
}

export function placeOrder(agent: Agent, context: CheckoutContext) {
  return agent.post(`${API}/checkout`).send({
    addressId: context.addressId,
    shippingMethodId: context.shippingMethodId,
    expectedTotal: context.total,
  });
}

export async function checkout(agent: Agent, addressId: string): Promise<CheckoutResult> {
  return ok<CheckoutResult>(await placeOrder(agent, await prepareCheckout(agent, addressId)));
}

/** Simulates the customer on the mock bank page and returns the gateway callback path. */
export async function payOnMockBank(
  agent: Agent,
  paymentUrl: string,
  result: 'success' | 'failed' | 'cancelled',
): Promise<string> {
  const authority = paymentUrl.split('/').pop() ?? '';
  const { redirectUrl } = ok<{ redirectUrl: string }>(
    await agent.post(`${API}/payments/mock/${authority}/complete`).send({ result }),
  );
  const url = new URL(redirectUrl);
  return `${url.pathname}${url.search}`;
}
