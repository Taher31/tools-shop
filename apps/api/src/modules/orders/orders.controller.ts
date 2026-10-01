import { Body, Get, Post, Put } from '@nestjs/common';
import {
  type AdminOrderDetail,
  type AdminOrderListQuery,
  adminOrderListQuerySchema,
  type AdminOrderSummary,
  type OrderStatusUpdateInput,
  orderStatusUpdateSchema,
  type Paginated,
} from '@toolshop/shared';
import { UuidParam, ZBody, ZQuery } from '../../common/decorators/validated.decorator';
import type { AuthContext } from '../auth/auth-context';
import { AdminController, CurrentUser, RequirePermissions } from '../auth/decorators';
import { OrdersService } from './orders.service';

@AdminController('orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermissions('order.read')
  list(
    @ZQuery(adminOrderListQuerySchema) query: AdminOrderListQuery,
  ): Promise<Paginated<AdminOrderSummary>> {
    return this.orders.listForAdmin(query);
  }

  @Get(':id')
  @RequirePermissions('order.read')
  get(@UuidParam() id: string): Promise<AdminOrderDetail> {
    return this.orders.getForAdmin(id);
  }

  @Post(':id/status')
  @RequirePermissions('order.update')
  updateStatus(
    @UuidParam() id: string,
    @ZBody(orderStatusUpdateSchema) input: OrderStatusUpdateInput,
    @CurrentUser() actor: AuthContext,
  ): Promise<AdminOrderDetail> {
    return this.orders.updateByStaff(id, input, actor);
  }

  @Put(':id/note')
  @RequirePermissions('order.update')
  note(@UuidParam() id: string, @Body() body: { note?: unknown }): Promise<AdminOrderDetail> {
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 2000) : '';
    return this.orders.updateAdminNote(id, note || null);
  }
}
