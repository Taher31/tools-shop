import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES, workerProviders } from '../../infrastructure/queue/queue.constants';
import { CouponsModule } from '../coupons/coupons.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AdminOrdersController } from './orders.controller';
import { OrdersProcessor } from './orders.processor';
import { OrdersService } from './orders.service';

@Module({
  imports: [InventoryModule, CouponsModule, BullModule.registerQueue({ name: QUEUES.ORDERS })],
  controllers: [AdminOrdersController],
  providers: [OrdersService, ...workerProviders(OrdersProcessor)],
  exports: [OrdersService],
})
export class OrdersModule {}
