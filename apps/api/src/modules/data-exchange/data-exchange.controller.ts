import {
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { DataEntityView, ImportReport } from '@toolshop/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import type { AuthContext } from '../auth/auth-context';
import { AdminController, CurrentUser, RequirePermissions } from '../auth/decorators';
import { DataExchangeService } from './data-exchange.service';
import type { TableFormat } from './tabular';

const formatSchema = z.enum(['xlsx', 'csv']).default('xlsx');

function send(
  response: Response,
  file: { buffer: Buffer; contentType: string; fileName: string },
): StreamableFile {
  response.setHeader('Cache-Control', 'no-store');
  return new StreamableFile(file.buffer, {
    type: file.contentType,
    disposition: `attachment; filename="${file.fileName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
  });
}

/**
 * Bulk import/export. Every call needs `data.import`/`data.export` plus the permissions
 * of the entity itself (e.g. importing products also needs product.create/update).
 */
@AdminController('data')
export class DataExchangeController {
  constructor(private readonly data: DataExchangeService) {}

  @Get('entities')
  // Baseline staff permission; the response only lists what the caller may use.
  @RequirePermissions('dashboard.read')
  entities(@CurrentUser() user: AuthContext): DataEntityView[] {
    return this.data.entities(user);
  }

  @Get(':entity/template')
  @RequirePermissions('data.import')
  @Header('X-Content-Type-Options', 'nosniff')
  async template(
    @Param('entity') entity: string,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return send(response, await this.data.template(entity, this.format(format), user));
  }

  @Get(':entity/export')
  @RequirePermissions('data.export')
  async export(
    @Param('entity') entity: string,
    @Query() query: Record<string, unknown>,
    @CurrentUser() user: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { format, ...filters } = query;
    return send(
      response,
      await this.data.export(entity, filters, this.format(format as string | undefined), user),
    );
  }

  @Post(':entity/import')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('data.import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  import(
    @Param('entity') entity: string,
    @Query('dryRun') dryRun: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthContext,
  ): Promise<ImportReport> {
    return this.data.import(entity, file, dryRun !== 'false', user);
  }

  private format(value: string | undefined): TableFormat {
    const parsed = formatSchema.safeParse(value ?? undefined);
    if (!parsed.success)
      throw AppException.validation([{ path: 'format', message: 'فرمت باید xlsx یا csv باشد.' }]);
    return parsed.data;
  }
}
