import { Controller, Delete, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import {
  type AddCartItemInput,
  addCartItemSchema,
  type ApplyCouponInput,
  applyCouponSchema,
  type CartView,
  type UpdateCartItemInput,
  updateCartItemSchema,
} from '@toolshop/shared';
import type { Request, Response } from 'express';
import { isUuid, ZBody } from '../../common/decorators/validated.decorator';
import { AppException } from '../../common/errors/app-exception';
import { randomToken } from '../../common/utils/crypto';
import { AppConfig } from '../../config/app-config';
import type { AuthContext } from '../auth/auth-context';
import { CART_COOKIE, setCartCookie } from '../auth/auth-cookies';
import { OptionalUser, Public } from '../auth/decorators';
import { type CartIdentity, CartService } from './cart.service';

/** Cart for guests (httpOnly cookie token) and customers (bound to the account). */
@Public()
@Controller('cart')
export class CartController {
  constructor(
    private readonly carts: CartService,
    private readonly config: AppConfig,
  ) {}

  @Get()
  get(@Req() request: Request, @OptionalUser() user: AuthContext | undefined): Promise<CartView> {
    return this.carts.view(this.identity(request, user));
  }

  @Post('items')
  add(
    @ZBody(addCartItemSchema) input: AddCartItemInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @OptionalUser() user: AuthContext | undefined,
  ): Promise<CartView> {
    return this.carts.addItem(this.identity(request, user, response), input);
  }

  @Patch('items/:itemId')
  update(
    @Param('itemId') itemId: string,
    @ZBody(updateCartItemSchema) input: UpdateCartItemInput,
    @Req() request: Request,
    @OptionalUser() user: AuthContext | undefined,
  ): Promise<CartView> {
    return this.carts.updateItem(this.identity(request, user), this.itemId(itemId), input.quantity);
  }

  @Delete('items/:itemId')
  remove(
    @Param('itemId') itemId: string,
    @Req() request: Request,
    @OptionalUser() user: AuthContext | undefined,
  ): Promise<CartView> {
    return this.carts.removeItem(this.identity(request, user), this.itemId(itemId));
  }

  @Post('coupon')
  applyCoupon(
    @ZBody(applyCouponSchema) input: ApplyCouponInput,
    @Req() request: Request,
    @OptionalUser() user: AuthContext | undefined,
  ): Promise<CartView> {
    return this.carts.applyCoupon(this.identity(request, user), input.code);
  }

  @Delete('coupon')
  removeCoupon(
    @Req() request: Request,
    @OptionalUser() user: AuthContext | undefined,
  ): Promise<CartView> {
    return this.carts.removeCoupon(this.identity(request, user));
  }

  /** Resolves the cart owner; issues a guest token cookie when `response` is given. */
  private identity(
    request: Request,
    user: AuthContext | undefined,
    response?: Response,
  ): CartIdentity {
    if (user) return { userId: user.userId };
    const token = (request.cookies as Record<string, string> | undefined)?.[CART_COOKIE];
    if (token && /^[A-Za-z0-9_-]{32,128}$/.test(token)) return { guestToken: token };
    if (!response) return {};
    const guestToken = randomToken(32);
    setCartCookie(response, this.config, guestToken);
    return { guestToken };
  }

  private itemId(value: string): string {
    if (!isUuid(value)) throw AppException.notFound();
    return value;
  }
}
