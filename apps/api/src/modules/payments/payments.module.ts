import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PaymentProviderRegistry } from './payment-provider.registry';
import {
  AdminPaymentsController,
  MockGatewayController,
  PaymentsController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PAYMENT_PROVIDERS, type PaymentProvider } from './providers/payment-provider';

/**
 * To add a real gateway: implement PaymentProvider (e.g. ZarinpalProvider), register it
 * here and add it to the PAYMENT_PROVIDERS factory. Nothing else changes.
 */
@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController, MockGatewayController, AdminPaymentsController],
  providers: [
    MockPaymentProvider,
    {
      provide: PAYMENT_PROVIDERS,
      inject: [MockPaymentProvider],
      useFactory: (...providers: PaymentProvider[]) => providers,
    },
    PaymentProviderRegistry,
    PaymentsService,
  ],
  exports: [PaymentsService, PaymentProviderRegistry],
})
export class PaymentsModule {}
