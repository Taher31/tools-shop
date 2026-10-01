import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { AccountController } from './account.controller';
import { AddressesService } from './addresses.service';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [AuthModule, CatalogModule, OrdersModule, PaymentsModule],
  controllers: [AccountController],
  providers: [AddressesService, WishlistService],
})
export class AccountModule {}
