import type { PaymentStatus } from '@toolshop/shared';

/** Amounts are integers in Rial. */
export interface CreatePaymentRequest {
  paymentId: string;
  orderId: string;
  orderNumber: number;
  amount: number;
  callbackUrl: string;
  description: string;
  customer: { mobile: string | null; email: string | null };
}

export interface CreatePaymentResult {
  /** Gateway token for this attempt (Authority / Token / TransId depending on the PSP). */
  authority: string;
  /** Where the customer's browser must be sent to pay. */
  redirectUrl: string;
  raw?: unknown;
}

export interface VerifyPaymentRequest {
  authority: string;
  amount: number;
  /** Every parameter the gateway sent to the callback URL. */
  callbackParams: Record<string, string>;
}

export type VerifyPaymentResult =
  | { status: 'succeeded'; referenceId: string; cardMask: string | null; raw?: unknown }
  | { status: 'failed' | 'cancelled'; reason: string; raw?: unknown };

export interface RefundPaymentRequest {
  authority: string;
  referenceId: string | null;
  amount: number;
}

export type RefundPaymentResult =
  | { status: 'succeeded'; reference: string | null; raw?: unknown }
  | { status: 'failed'; reason: string; raw?: unknown };

export interface PaymentStatusResult {
  status: PaymentStatus;
  referenceId: string | null;
}

/**
 * Contract every payment gateway adapter implements (mock, Zarinpal, IDPay, Sep, ...).
 * The payment service owns the database and the order state machine; adapters only
 * translate to/from the gateway API, so swapping PSPs never touches business logic.
 */
export interface PaymentProvider {
  readonly code: string;
  readonly displayName: string;
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult>;
  verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResult>;
  refundPayment(request: RefundPaymentRequest): Promise<RefundPaymentResult>;
  getPaymentStatus(authority: string): Promise<PaymentStatusResult>;
  /** Reads the payment token from the gateway's callback parameters. */
  parseCallback(params: Record<string, string>): { authority: string | null };
}

export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
