import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { AdminDashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [InventoryModule],
  controllers: [AdminDashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
