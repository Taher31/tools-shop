import { Get, Post, Put } from '@nestjs/common';
import {
  type ShippingMethodUpsertInput,
  shippingMethodUpsertSchema,
  type ShippingMethodView,
} from '@toolshop/shared';
import { UuidParam, ZBody } from '../../common/decorators/validated.decorator';
import { AdminController, RequirePermissions } from '../auth/decorators';
import { ShippingService } from './shipping.service';

@AdminController('shipping-methods')
export class AdminShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get()
  @RequirePermissions('shipping.manage')
  list(): Promise<ShippingMethodView[]> {
    return this.shipping.list();
  }

  @Post()
  @RequirePermissions('shipping.manage')
  create(
    @ZBody(shippingMethodUpsertSchema) input: ShippingMethodUpsertInput,
  ): Promise<ShippingMethodView> {
    return this.shipping.create(input);
  }

  @Put(':id')
  @RequirePermissions('shipping.manage')
  update(
    @UuidParam() id: string,
    @ZBody(shippingMethodUpsertSchema) input: ShippingMethodUpsertInput,
  ): Promise<ShippingMethodView> {
    return this.shipping.update(id, input);
  }
}
