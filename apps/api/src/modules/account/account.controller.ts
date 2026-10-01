import { Controller, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import {
  type AddressUpsertInput,
  addressUpsertSchema,
  type AddressView,
  type AuthUser,
  type CancelOrderInput,
  cancelOrderSchema,
  type ChangePasswordInput,
  changePasswordSchema,
  type OrderDetail,
  type OrderSummary,
  type Paginated,
  type PaginationQuery,
  paginationQuerySchema,
  type UpdateProfileInput,
  updateProfileSchema,
  type WishlistItem,
} from '@toolshop/shared';
import { z } from 'zod';
import { UuidParam, ZBody, ZQuery } from '../../common/decorators/validated.decorator';
import type { AuthContext } from '../auth/auth-context';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { AddressesService } from './addresses.service';
import { WishlistService } from './wishlist.service';

const payAgainSchema = z.object({ paymentProvider: z.string().trim().max(40).optional() });

/** Customer self-service. Every query is scoped to the authenticated user. */
@Controller('account')
export class AccountController {
  constructor(
    private readonly auth: AuthService,
    private readonly addresses: AddressesService,
    private readonly wishlist: WishlistService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
  ) {}

  @Get('profile')
  profile(@CurrentUser() user: AuthContext): Promise<AuthUser> {
    return this.auth.getAuthUser(user.userId);
  }

  @Put('profile')
  updateProfile(
    @CurrentUser() user: AuthContext,
    @ZBody(updateProfileSchema) input: UpdateProfileInput,
  ): Promise<AuthUser> {
    return this.auth.updateProfile(user.userId, input);
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() user: AuthContext,
    @ZBody(changePasswordSchema) input: ChangePasswordInput,
  ): Promise<void> {
    return this.auth.changePassword(user.userId, user.sessionId, input);
  }

  @Get('addresses')
  listAddresses(@CurrentUser() user: AuthContext): Promise<AddressView[]> {
    return this.addresses.list(user.userId);
  }

  @Post('addresses')
  createAddress(
    @CurrentUser() user: AuthContext,
    @ZBody(addressUpsertSchema) input: AddressUpsertInput,
  ): Promise<AddressView> {
    return this.addresses.create(user.userId, input);
  }

  @Put('addresses/:id')
  updateAddress(
    @CurrentUser() user: AuthContext,
    @UuidParam() id: string,
    @ZBody(addressUpsertSchema) input: AddressUpsertInput,
  ): Promise<AddressView> {
    return this.addresses.update(user.userId, id, input);
  }

  @Post('addresses/:id/default')
  setDefaultAddress(
    @CurrentUser() user: AuthContext,
    @UuidParam() id: string,
  ): Promise<AddressView[]> {
    return this.addresses.setDefault(user.userId, id);
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAddress(@CurrentUser() user: AuthContext, @UuidParam() id: string): Promise<void> {
    return this.addresses.remove(user.userId, id);
  }

  @Get('orders')
  listOrders(
    @CurrentUser() user: AuthContext,
    @ZQuery(paginationQuerySchema) query: PaginationQuery,
  ): Promise<Paginated<OrderSummary>> {
    return this.orders.listForCustomer(user.userId, query);
  }

  @Get('orders/:id')
  getOrder(@CurrentUser() user: AuthContext, @UuidParam() id: string): Promise<OrderDetail> {
    return this.orders.getForCustomer(id, user.userId);
  }

  @Post('orders/:id/cancel')
  cancelOrder(
    @CurrentUser() user: AuthContext,
    @UuidParam() id: string,
    @ZBody(cancelOrderSchema) input: CancelOrderInput,
  ): Promise<OrderDetail> {
    return this.orders.cancelByCustomer(id, user.userId, input.reason);
  }

  /** New payment attempt for an order still awaiting payment. */
  @Post('orders/:id/pay')
  payOrder(
    @CurrentUser() user: AuthContext,
    @UuidParam() id: string,
    @ZBody(payAgainSchema) input: z.infer<typeof payAgainSchema>,
  ): Promise<{ paymentUrl: string; amount: number }> {
    return this.payments.start(id, user.userId, input.paymentProvider);
  }

  @Get('wishlist')
  wishlistItems(@CurrentUser() user: AuthContext): Promise<WishlistItem[]> {
    return this.wishlist.list(user.userId);
  }

  @Get('wishlist/ids')
  wishlistIds(@CurrentUser() user: AuthContext): Promise<string[]> {
    return this.wishlist.ids(user.userId);
  }

  @Put('wishlist/:productId')
  addToWishlist(
    @CurrentUser() user: AuthContext,
    @UuidParam('productId') productId: string,
  ): Promise<string[]> {
    return this.wishlist.add(user.userId, productId);
  }

  @Delete('wishlist/:productId')
  removeFromWishlist(
    @CurrentUser() user: AuthContext,
    @UuidParam('productId') productId: string,
  ): Promise<string[]> {
    return this.wishlist.remove(user.userId, productId);
  }
}
