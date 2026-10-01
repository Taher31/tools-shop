import { Get } from '@nestjs/common';
import type { DashboardStats } from '@toolshop/shared';
import { AdminController, RequirePermissions } from '../auth/decorators';
import { DashboardService } from './dashboard.service';

@AdminController('dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermissions('dashboard.read')
  stats(): Promise<DashboardStats> {
    return this.dashboard.stats();
  }
}
