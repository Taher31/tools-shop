import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CouponsModule } from '../coupons/coupons.module';
import { CustomersModule } from '../customers/customers.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { DataExchangeController } from './data-exchange.controller';
import { DataExchangeService } from './data-exchange.service';
import { BrandsHandler } from './handlers/brands.handler';
import { CategoriesHandler } from './handlers/categories.handler';
import { CouponsHandler } from './handlers/coupons.handler';
import { InventoryHandler } from './handlers/inventory.handler';
import { ProductsHandler } from './handlers/products.handler';
import { CustomersExportHandler, OrdersExportHandler } from './handlers/reports.handlers';

@Module({
  imports: [CatalogModule, CouponsModule, CustomersModule, InventoryModule, OrdersModule],
  controllers: [DataExchangeController],
  providers: [
    DataExchangeService,
    ProductsHandler,
    CategoriesHandler,
    BrandsHandler,
    CouponsHandler,
    InventoryHandler,
    OrdersExportHandler,
    CustomersExportHandler,
  ],
})
export class DataExchangeModule {}
