import { Controller, Get, Param, Put, Body } from '@nestjs/common';
import { type PublicSettings, SETTINGS_GROUPS, type SettingsGroup } from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminController, Public, RequirePermissions } from '../auth/decorators';
import { type AllSettings, SettingsService } from './settings.service';

@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('public')
  getPublic(): Promise<PublicSettings> {
    return this.settings.getPublic();
  }
}

@AdminController('settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions('settings.read')
  getAll(): Promise<AllSettings> {
    return this.settings.getAll();
  }

  @Put(':group')
  @RequirePermissions('settings.update')
  update(@Param('group') group: string, @Body() body: unknown): Promise<unknown> {
    if (!(group in SETTINGS_GROUPS)) throw AppException.notFound('گروه تنظیمات یافت نشد.');
    const key = group as SettingsGroup;
    const value = new ZodValidationPipe(SETTINGS_GROUPS[key]).transform(body);
    return this.settings.update(key, value as never);
  }
}
