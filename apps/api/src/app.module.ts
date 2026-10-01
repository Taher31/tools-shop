import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { OriginCheckMiddleware } from './common/http/origin-check.middleware';
import { RequestContextMiddleware } from './common/http/request-context.middleware';
import { AppConfig } from './config/app-config';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './infrastructure/logging/logger.module';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { REDIS } from './infrastructure/redis/redis.constants';
import { RedisModule } from './infrastructure/redis/redis.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AccessModule } from './modules/access/access.module';
import { AccountModule } from './modules/account/account.module';
import { AuditModule } from './modules/audit/audit.module';
import { isAuthRateLimited } from './modules/auth/auth-throttle';
import { AuthModule } from './modules/auth/auth.module';
import { RedisThrottlerStorage } from './modules/auth/redis-throttler.storage';
import { CartModule } from './modules/cart/cart.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { ContentModule } from './modules/content/content.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MediaModule } from './modules/media/media.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SearchModule } from './modules/search/search.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ShippingModule } from './modules/shipping/shipping.module';

@Module({
  imports: [
    // Infrastructure
    ConfigModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,
    EventEmitterModule.forRoot({ wildcard: false, maxListeners: 50 }),
    OutboxModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfig, REDIS],
      useFactory: (config: AppConfig, redis: Redis) => ({
        throttlers: [
          { name: 'default', ttl: config.rateLimit.ttlSeconds * 1000, limit: config.rateLimit.max },
          { name: 'auth', ttl: 60_000, limit: config.rateLimit.authMax, skipIf: (ctx) => !isAuthRateLimited(ctx) },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    // Platform
    AuditModule,
    SettingsModule,
    AuthModule,
    AccessModule,
    // Commerce
    CatalogModule,
    SearchModule,
    InventoryModule,
    MediaModule,
    CouponsModule,
    ShippingModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    CheckoutModule,
    AccountModule,
    CustomersModule,
    ReviewsModule,
    ContentModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware, OriginCheckMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
