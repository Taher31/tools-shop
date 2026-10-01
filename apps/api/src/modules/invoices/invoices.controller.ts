import { Controller, Get, Post } from '@nestjs/common';
import {
  type AdminInvoiceListQuery,
  adminInvoiceListQuerySchema,
  type InvoiceSummary,
  type InvoiceView,
  type Paginated,
} from '@toolshop/shared';
import { UuidParam, ZQuery } from '../../common/decorators/validated.decorator';
import type { AuthContext } from '../auth/auth-context';
import { AdminController, CurrentUser, RequirePermissions } from '../auth/decorators';
import { InvoicesService } from './invoices.service';

@Controller('account')
export class AccountInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get('orders/:id/invoices')
  forOrder(@UuidParam() id: string, @CurrentUser() user: AuthContext): Promise<InvoiceSummary[]> {
    return this.invoices.listForOrder(id, user.userId);
  }

  @Get('invoices/:id')
  get(@UuidParam() id: string, @CurrentUser() user: AuthContext): Promise<InvoiceView> {
    return this.invoices.getForCustomer(id, user.userId);
  }
}

@AdminController('invoices')
export class AdminInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermissions('invoice.read')
  list(
    @ZQuery(adminInvoiceListQuerySchema) query: AdminInvoiceListQuery,
  ): Promise<Paginated<InvoiceSummary>> {
    return this.invoices.list(query);
  }

  @Get('orders/:id')
  @RequirePermissions('invoice.read')
  forOrder(@UuidParam() id: string): Promise<InvoiceSummary[]> {
    return this.invoices.listForAdminOrder(id);
  }

  @Post('orders/:id')
  @RequirePermissions('invoice.issue')
  issue(@UuidParam() id: string, @CurrentUser() user: AuthContext): Promise<InvoiceView> {
    return this.invoices.issueForOrder(id, user.userId);
  }

  @Get(':id')
  @RequirePermissions('invoice.read')
  get(@UuidParam() id: string): Promise<InvoiceView> {
    return this.invoices.get(id);
  }
}
