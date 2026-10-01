import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app-exception';
import { AppConfig } from '../../config/app-config';
import { PAYMENT_PROVIDERS, type PaymentProvider } from './providers/payment-provider';

@Injectable()
export class PaymentProviderRegistry {
  private readonly logger = new Logger(PaymentProviderRegistry.name);
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(
    @Inject(PAYMENT_PROVIDERS) providers: PaymentProvider[],
    private readonly config: AppConfig,
  ) {
    for (const provider of providers) {
      if (
        provider.code === 'mock' &&
        config.isProduction &&
        !config.payments.allowMockInProduction
      ) {
        this.logger.warn('Mock payment provider is disabled in production');
        continue;
      }
      this.providers.set(provider.code, provider);
    }
  }

  get(code?: string): PaymentProvider {
    const provider = this.providers.get(code ?? this.config.payments.defaultProvider);
    if (!provider) throw new AppException('PAYMENT_PROVIDER_UNAVAILABLE');
    return provider;
  }

  has(code: string): boolean {
    return this.providers.has(code);
  }

  available(): { code: string; name: string }[] {
    return [...this.providers.values()].map((provider) => ({
      code: provider.code,
      name: provider.displayName,
    }));
  }
}
