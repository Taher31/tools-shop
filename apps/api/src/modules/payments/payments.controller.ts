import { All, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import {
  type AdminPaymentView,
  type AdminPaymentListQuery,
  adminPaymentListQuerySchema,
  type MockPaymentSession,
  type Paginated,
  type PaymentResultView,
  type RefundInput,
  refundSchema,
} from '@toolshop/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { isUuid, UuidParam, ZBody, ZQuery } from '../../common/decorators/validated.decorator';
import { AppException } from '../../common/errors/app-exception';
import { AppConfig } from '../../config/app-config';
import type { AuthContext } from '../auth/auth-context';
import { AdminController, CurrentUser, Public, RequirePermissions } from '../auth/decorators';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';

function flatten(source: unknown): Record<string, string> {
  if (typeof source !== 'object' || source === null) return {};
  return Object.fromEntries(
    Object.entries(source as Record<string, unknown>)
      .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
      .map(([key, value]) => [key, String(value).slice(0, 500)]),
  );
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly config: AppConfig,
  ) {}

  /** Gateways redirect the customer here (GET or POST form) after the bank page. */
  @Public()
  @All('callback/:provider')
  async callback(
    @Param('provider') provider: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const params = { ...flatten(request.query), ...flatten(request.body) };
    try {
      const outcome = await this.payments.handleCallback(provider.slice(0, 40), params);
      response.redirect(302, outcome.redirectUrl);
    } catch {
      response.redirect(302, `${this.config.publicUrl}/checkout/result?error=payment_not_found`);
    }
  }

  @Get('result')
  result(
    @Query('order') orderId: string | undefined,
    @CurrentUser() user: AuthContext,
  ): Promise<PaymentResultView> {
    if (!orderId || !isUuid(orderId)) throw AppException.notFound();
    return this.payments.resultForOrder(orderId, user.userId);
  }
}

const mockCompleteSchema = z.object({ result: z.enum(['success', 'failed', 'cancelled']) });

/** Fake bank page API, only mounted while the mock provider is enabled. */
@Public()
@Controller('payments/mock')
export class MockGatewayController {
  constructor(
    private readonly mock: MockPaymentProvider,
    private readonly registry: PaymentProviderRegistry,
  ) {}

  @Get(':authority')
  session(@Param('authority') authority: string): Promise<MockPaymentSession> {
    this.assertEnabled();
    return this.mock.session(authority);
  }

  @Post(':authority/complete')
  complete(
    @Param('authority') authority: string,
    @ZBody(mockCompleteSchema) input: z.infer<typeof mockCompleteSchema>,
  ): Promise<{ redirectUrl: string }> {
    this.assertEnabled();
    return this.mock.complete(authority, input.result);
  }

  private assertEnabled(): void {
    if (!this.registry.has('mock')) throw AppException.notFound();
  }
}

@AdminController('payments')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermissions('payment.read')
  list(
    @ZQuery(adminPaymentListQuerySchema) query: AdminPaymentListQuery,
  ): Promise<Paginated<AdminPaymentView>> {
    return this.payments.adminList(query);
  }

  @Post(':id/refund')
  @RequirePermissions('payment.refund')
  refund(
    @UuidParam() id: string,
    @ZBody(refundSchema) input: RefundInput,
  ): Promise<AdminPaymentView> {
    return this.payments.refund(id, input);
  }
}
