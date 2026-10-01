import { Get, Put } from '@nestjs/common';
import { type CustomerDetail, type CustomerListItem, type ListQuery, listQuerySchema, type Paginated } from '@toolshop/shared';
import { z } from 'zod';
import { UuidParam, ZBody, ZQuery } from '../../common/decorators/validated.decorator';
import { AdminController, RequirePermissions } from '../auth/decorators';
import { CustomersService } from './customers.service';

const statusSchema = z.object({ isActive: z.boolean() });

@AdminController('customers')
export class AdminCustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('customer.read')
  list(@ZQuery(listQuerySchema) query: ListQuery): Promise<Paginated<CustomerListItem>> {
    return this.customers.list(query);
  }

  @Get(':id')
  @RequirePermissions('customer.read')
  get(@UuidParam() id: string): Promise<CustomerDetail> {
    return this.customers.get(id);
  }

  @Put(':id/status')
  @RequirePermissions('customer.update')
  setStatus(@UuidParam() id: string, @ZBody(statusSchema) input: z.infer<typeof statusSchema>): Promise<CustomerDetail> {
    return this.customers.setActive(id, input.isActive);
  }
}
