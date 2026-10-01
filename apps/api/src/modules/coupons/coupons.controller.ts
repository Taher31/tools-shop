import { Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import {
  type CouponUpsertInput,
  couponUpsertSchema,
  type CouponView,
  type ListQuery,
  listQuerySchema,
  type Paginated,
} from '@toolshop/shared';
import { UuidParam, ZBody, ZQuery } from '../../common/decorators/validated.decorator';
import { AdminController, RequirePermissions } from '../auth/decorators';
import { CouponsService } from './coupons.service';

@AdminController('coupons')
export class AdminCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  @RequirePermissions('coupon.read')
  list(@ZQuery(listQuerySchema) query: ListQuery): Promise<Paginated<CouponView>> {
    return this.coupons.list(query);
  }

  @Post()
  @RequirePermissions('coupon.manage')
  create(@ZBody(couponUpsertSchema) input: CouponUpsertInput): Promise<CouponView> {
    return this.coupons.create(input);
  }

  @Put(':id')
  @RequirePermissions('coupon.manage')
  update(
    @UuidParam() id: string,
    @ZBody(couponUpsertSchema) input: CouponUpsertInput,
  ): Promise<CouponView> {
    return this.coupons.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('coupon.manage')
  remove(@UuidParam() id: string): Promise<void> {
    return this.coupons.remove(id);
  }
}
