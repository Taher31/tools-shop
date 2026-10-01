import { Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import {
  type IntegrationLogView,
  type IntegrationUpdateInput,
  integrationUpdateSchema,
  type IntegrationView,
  type Paginated,
  type PaginationQuery,
  paginationQuerySchema,
} from '@toolshop/shared';
import { ZBody, ZQuery } from '../../common/decorators/validated.decorator';
import { AdminController, Public, RequirePermissions } from '../auth/decorators';
import { IntegrationsService } from './integrations.service';

const code = (value: string) => value.slice(0, 40);

@AdminController('integrations')
export class AdminIntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  @RequirePermissions('integration.read')
  list(): Promise<IntegrationView[]> {
    return this.integrations.list();
  }

  @Get(':code/logs')
  @RequirePermissions('integration.read')
  logs(
    @Param('code') value: string,
    @ZQuery(paginationQuerySchema) query: PaginationQuery,
  ): Promise<Paginated<IntegrationLogView>> {
    return this.integrations.logs(code(value), query);
  }

  @Put(':code')
  @RequirePermissions('integration.manage')
  update(
    @Param('code') value: string,
    @ZBody(integrationUpdateSchema) input: IntegrationUpdateInput,
  ): Promise<IntegrationView> {
    return this.integrations.update(code(value), input);
  }

  @Post(':code/test')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('integration.manage')
  test(@Param('code') value: string): Promise<IntegrationView> {
    return this.integrations.testConnection(code(value));
  }

  @Post(':code/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('integration.manage')
  sync(
    @Param('code') value: string,
    @Query('failed') failed?: string,
  ): Promise<{ queued: number }> {
    return this.integrations.enqueueFullSync(code(value), failed === 'true');
  }
}

/** Product feeds read by pull channels (price comparison sites). Token protected. */
@Controller('feeds')
export class FeedsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Public()
  @Get(':code')
  feed(
    @Param('code') value: string,
    @Query('token') token?: string,
  ): Promise<Record<string, unknown>> {
    return this.integrations.feed(code(value), typeof token === 'string' ? token : undefined);
  }
}
