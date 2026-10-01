import { Controller, Get, Post, Query, Req } from '@nestjs/common';
import {
  type CartTotals,
  type CheckoutInput,
  type CheckoutPreview,
  type CheckoutResult,
  checkoutSchema,
  idSchema,
} from '@toolshop/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { isUuid, ZBody } from '../../common/decorators/validated.decorator';
import type { AuthContext } from '../auth/auth-context';
import { CurrentUser } from '../auth/decorators';
import { CheckoutService } from './checkout.service';

const quoteSchema = z.object({ addressId: idSchema, shippingMethodId: idSchema });

/** Checkout requires a customer account (cart from a guest session is merged on login). */
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Get()
  preview(@CurrentUser() user: AuthContext, @Query('addressId') addressId?: string): Promise<CheckoutPreview> {
    return this.checkout.preview(user.userId, addressId && isUuid(addressId) ? addressId : undefined);
  }

  @Post('quote')
  quote(@CurrentUser() user: AuthContext, @ZBody(quoteSchema) input: z.infer<typeof quoteSchema>): Promise<CartTotals> {
    return this.checkout.quote(user.userId, input.addressId, input.shippingMethodId);
  }

  @Post()
  place(
    @CurrentUser() user: AuthContext,
    @ZBody(checkoutSchema) input: CheckoutInput,
    @Req() request: Request,
  ): Promise<CheckoutResult> {
    return this.checkout.placeOrder(user.userId, input, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent')?.slice(0, 400),
    });
  }
}
