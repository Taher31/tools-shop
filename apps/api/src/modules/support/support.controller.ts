import { Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import {
  type AdminTicketDetail,
  type AdminTicketListQuery,
  adminTicketListQuerySchema,
  type AdminTicketSummary,
  type Paginated,
  type PaginationQuery,
  paginationQuerySchema,
  type StaffOption,
  type StaffTicketReplyInput,
  staffTicketReplySchema,
  type TicketCreateInput,
  ticketCreateSchema,
  type TicketDetail,
  type TicketReplyInput,
  ticketReplySchema,
  type TicketSummary,
  type TicketUpdateInput,
  ticketUpdateSchema,
} from '@toolshop/shared';
import { UuidParam, ZBody, ZQuery } from '../../common/decorators/validated.decorator';
import type { AuthContext } from '../auth/auth-context';
import { AdminController, CurrentUser, RequirePermissions } from '../auth/decorators';
import { SupportService } from './support.service';

/** The signed-in customer's own tickets. */
@Controller('account/tickets')
export class AccountTicketsController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(
    @ZQuery(paginationQuerySchema) query: PaginationQuery,
    @CurrentUser() user: AuthContext,
  ): Promise<Paginated<TicketSummary>> {
    return this.support.listForCustomer(user.userId, query);
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: AuthContext): Promise<{ count: number }> {
    return { count: await this.support.unreadCountForCustomer(user.userId) };
  }

  @Post()
  create(
    @ZBody(ticketCreateSchema) input: TicketCreateInput,
    @CurrentUser() user: AuthContext,
  ): Promise<TicketDetail> {
    return this.support.create(user.userId, input);
  }

  @Get(':id')
  get(@UuidParam() id: string, @CurrentUser() user: AuthContext): Promise<TicketDetail> {
    return this.support.getForCustomer(id, user.userId);
  }

  @Post(':id/messages')
  reply(
    @UuidParam() id: string,
    @ZBody(ticketReplySchema) input: TicketReplyInput,
    @CurrentUser() user: AuthContext,
  ): Promise<TicketDetail> {
    return this.support.replyAsCustomer(id, user.userId, input);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  close(@UuidParam() id: string, @CurrentUser() user: AuthContext): Promise<TicketDetail> {
    return this.support.closeByCustomer(id, user.userId);
  }
}

@AdminController('tickets')
export class AdminTicketsController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @RequirePermissions('ticket.read')
  list(
    @ZQuery(adminTicketListQuerySchema) query: AdminTicketListQuery,
    @CurrentUser() user: AuthContext,
  ): Promise<Paginated<AdminTicketSummary>> {
    return this.support.listForAdmin(query, user);
  }

  @Get('counters')
  @RequirePermissions('ticket.read')
  counters(@CurrentUser() user: AuthContext) {
    return this.support.adminCounters(user);
  }

  @Get('staff')
  @RequirePermissions('ticket.read')
  staff(): Promise<StaffOption[]> {
    return this.support.staffOptions();
  }

  @Get(':id')
  @RequirePermissions('ticket.read')
  get(@UuidParam() id: string): Promise<AdminTicketDetail> {
    return this.support.getForAdmin(id);
  }

  @Post(':id/messages')
  @RequirePermissions('ticket.reply')
  reply(
    @UuidParam() id: string,
    @ZBody(staffTicketReplySchema) input: StaffTicketReplyInput,
    @CurrentUser() user: AuthContext,
  ): Promise<AdminTicketDetail> {
    return this.support.replyAsStaff(id, input, user);
  }

  @Put(':id')
  @RequirePermissions('ticket.manage')
  update(
    @UuidParam() id: string,
    @ZBody(ticketUpdateSchema) input: TicketUpdateInput,
  ): Promise<AdminTicketDetail> {
    return this.support.update(id, input);
  }
}
