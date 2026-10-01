import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { MockPaymentSession, PaymentStatus } from '@toolshop/shared';
import type { Redis } from 'ioredis';
import { AppException } from '../../../common/errors/app-exception';
import { randomToken } from '../../../common/utils/crypto';
import { AppConfig } from '../../../config/app-config';
import { REDIS } from '../../../infrastructure/redis/redis.constants';
import type {
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentProvider,
  PaymentStatusResult,
  RefundPaymentResult,
  VerifyPaymentRequest,
  VerifyPaymentResult,
} from './payment-provider';

interface StoredSession {
  amount: number;
  orderNumber: number;
  callbackUrl: string;
  status: PaymentStatus;
  referenceId: string | null;
  cardMask: string | null;
}

const SESSION_TTL_SECONDS = 3600;
const key = (authority: string) => `mockpay:${authority}`;

/**
 * Development gateway that mimics the redirect → callback → verify flow of Iranian PSPs.
 * The storefront renders /payment/mock/<authority> as the "bank page".
 * Disabled in production unless PAYMENT_ALLOW_MOCK_IN_PRODUCTION=true (staging only).
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly code = 'mock';
  readonly displayName = 'درگاه آزمایشی';

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: AppConfig,
  ) {}

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const authority = `MOCK${randomToken(18).replace(/[-_]/g, '').toUpperCase()}`;
    const session: StoredSession = {
      amount: request.amount,
      orderNumber: request.orderNumber,
      callbackUrl: request.callbackUrl,
      status: 'pending',
      referenceId: null,
      cardMask: null,
    };
    await this.redis.set(key(authority), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
    return { authority, redirectUrl: `${this.config.publicUrl}/payment/mock/${authority}` };
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResult> {
    const session = await this.load(request.authority);
    if (!session) return { status: 'failed', reason: 'جلسه پرداخت یافت نشد یا منقضی شده است.' };
    if (session.amount !== request.amount)
      return { status: 'failed', reason: 'مبلغ پرداخت با سفارش مغایرت دارد.' };
    if (session.status === 'cancelled')
      return { status: 'cancelled', reason: 'پرداخت توسط کاربر لغو شد.' };
    if (session.status === 'failed') return { status: 'failed', reason: 'تراکنش توسط بانک رد شد.' };
    if (session.status !== 'succeeded')
      return { status: 'failed', reason: 'پرداخت تکمیل نشده است.' };
    return {
      status: 'succeeded',
      referenceId: session.referenceId ?? '',
      cardMask: session.cardMask,
    };
  }

  async refundPayment(): Promise<RefundPaymentResult> {
    return { status: 'succeeded', reference: `RF${randomInt(100_000_000, 999_999_999)}` };
  }

  async getPaymentStatus(authority: string): Promise<PaymentStatusResult> {
    const session = await this.load(authority);
    return { status: session?.status ?? 'failed', referenceId: session?.referenceId ?? null };
  }

  parseCallback(params: Record<string, string>): { authority: string | null } {
    return { authority: params['authority'] ?? params['Authority'] ?? null };
  }

  /** Data for the fake bank page. */
  async session(authority: string): Promise<MockPaymentSession> {
    const session = await this.load(authority);
    if (!session) throw AppException.notFound('جلسه پرداخت یافت نشد یا منقضی شده است.');
    return {
      authority,
      amount: session.amount,
      orderNumber: session.orderNumber,
      status: session.status,
      callbackUrl: session.callbackUrl,
    };
  }

  /** Simulates the customer's action on the bank page; returns the callback URL to visit. */
  async complete(
    authority: string,
    result: 'success' | 'failed' | 'cancelled',
  ): Promise<{ redirectUrl: string }> {
    const session = await this.load(authority);
    if (!session) throw AppException.notFound('جلسه پرداخت یافت نشد یا منقضی شده است.');
    if (session.status === 'pending') {
      session.status = result === 'success' ? 'succeeded' : result;
      if (result === 'success') {
        session.referenceId =
          String(randomInt(100_000_000, 999_999_999)) + String(randomInt(100, 999));
        session.cardMask = `603799******${String(randomInt(1000, 9999))}`;
      }
      await this.redis.set(key(authority), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
    }
    const url = new URL(session.callbackUrl);
    url.searchParams.set('authority', authority);
    url.searchParams.set('status', session.status === 'succeeded' ? 'OK' : 'NOK');
    return { redirectUrl: url.toString() };
  }

  private async load(authority: string): Promise<StoredSession | null> {
    if (!/^MOCK[A-Z0-9]{10,40}$/.test(authority)) return null;
    const raw = await this.redis.get(key(authority));
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  }
}
