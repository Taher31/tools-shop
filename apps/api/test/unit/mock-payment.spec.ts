import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppConfig } from '../../src/config/app-config';
import { MockPaymentProvider } from '../../src/modules/payments/providers/mock-payment.provider';

/** Minimal in-memory stand-in for the two Redis commands the provider uses. */
class FakeRedis {
  readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, value);
    return 'OK';
  }
}

const config = { publicUrl: 'http://shop.test' } as AppConfig;
const request = {
  paymentId: 'p1',
  orderId: 'o1',
  orderNumber: 100001,
  amount: 12_500_000,
  callbackUrl: 'http://shop.test/api/v1/payments/callback/mock?paymentId=p1',
  description: 'سفارش ۱۰۰۰۰۱',
  customer: { mobile: '09120000000', email: null },
};

describe('MockPaymentProvider', () => {
  let provider: MockPaymentProvider;

  beforeEach(() => {
    provider = new MockPaymentProvider(new FakeRedis() as unknown as Redis, config);
  });

  it('creates a session and redirects to the fake bank page', async () => {
    const { authority, redirectUrl } = await provider.createPayment(request);
    expect(authority).toMatch(/^MOCK[A-Z0-9]{10,40}$/);
    expect(redirectUrl).toBe(`http://shop.test/payment/mock/${authority}`);
    expect(await provider.getPaymentStatus(authority)).toEqual({
      status: 'pending',
      referenceId: null,
    });
  });

  it('does not verify a payment the customer has not completed', async () => {
    const { authority } = await provider.createPayment(request);
    const result = await provider.verifyPayment({
      authority,
      amount: request.amount,
      callbackParams: {},
    });
    expect(result.status).toBe('failed');
  });

  it('verifies a successful payment and rejects an amount mismatch', async () => {
    const { authority } = await provider.createPayment(request);
    const { redirectUrl } = await provider.complete(authority, 'success');
    const callback = new URL(redirectUrl);
    expect(callback.searchParams.get('authority')).toBe(authority);
    expect(callback.searchParams.get('status')).toBe('OK');
    expect(callback.searchParams.get('paymentId')).toBe('p1');

    const verified = await provider.verifyPayment({
      authority,
      amount: request.amount,
      callbackParams: {},
    });
    expect(verified).toMatchObject({ status: 'succeeded' });
    if (verified.status === 'succeeded') expect(verified.referenceId).toMatch(/^\d{12}$/);

    const tampered = await provider.verifyPayment({
      authority,
      amount: request.amount - 1,
      callbackParams: {},
    });
    expect(tampered.status).toBe('failed');
  });

  it('keeps the first outcome when the bank page is submitted twice', async () => {
    const { authority } = await provider.createPayment(request);
    await provider.complete(authority, 'cancelled');
    const second = await provider.complete(authority, 'success');
    expect(new URL(second.redirectUrl).searchParams.get('status')).toBe('NOK');
    const result = await provider.verifyPayment({
      authority,
      amount: request.amount,
      callbackParams: {},
    });
    expect(result.status).toBe('cancelled');
  });

  it('treats malformed or unknown authorities as failed without touching Redis keys', async () => {
    expect(
      (await provider.verifyPayment({ authority: '../../etc', amount: 1, callbackParams: {} }))
        .status,
    ).toBe('failed');
    expect(provider.parseCallback({ Authority: 'MOCKABC' })).toEqual({ authority: 'MOCKABC' });
    await expect(provider.session('MOCKUNKNOWN0000')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
