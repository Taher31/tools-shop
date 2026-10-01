import { Module } from '@nestjs/common';
import { AdminInventoryController, AdminWarehousesController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { WarehousesService } from './warehouses.service';

@Module({
  controllers: [AdminInventoryController, AdminWarehousesController],
  providers: [InventoryService, WarehousesService],
  exports: [InventoryService],
})
export class InventoryModule {}
