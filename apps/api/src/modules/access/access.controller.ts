import { Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import {
  type ListQuery,
  listQuerySchema,
  type Paginated,
  type PermissionDefinition,
  type RoleUpsertInput,
  roleUpsertSchema,
  type RoleView,
  type StaffUserCreateInput,
  staffUserCreateSchema,
  type StaffUserUpdateInput,
  staffUserUpdateSchema,
  type StaffUserView,
} from '@toolshop/shared';
import { UuidParam, ZBody, ZQuery } from '../../common/decorators/validated.decorator';
import type { AuthContext } from '../auth/auth-context';
import { AdminController, CurrentUser, RequirePermissions } from '../auth/decorators';
import { RolesService } from './roles.service';
import { StaffUsersService } from './staff-users.service';

@AdminController('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('permissions')
  @RequirePermissions('role.read')
  permissions(): readonly PermissionDefinition[] {
    return this.roles.permissionCatalog();
  }

  @Get()
  @RequirePermissions('role.read')
  list(): Promise<RoleView[]> {
    return this.roles.list();
  }

  @Post()
  @RequirePermissions('role.manage')
  create(@ZBody(roleUpsertSchema) input: RoleUpsertInput): Promise<RoleView> {
    return this.roles.create(input);
  }

  @Put(':id')
  @RequirePermissions('role.manage')
  update(
    @UuidParam() id: string,
    @ZBody(roleUpsertSchema) input: RoleUpsertInput,
  ): Promise<RoleView> {
    return this.roles.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('role.manage')
  remove(@UuidParam() id: string): Promise<void> {
    return this.roles.remove(id);
  }
}

@AdminController('users')
export class StaffUsersController {
  constructor(private readonly users: StaffUsersService) {}

  @Get()
  @RequirePermissions('user.read')
  list(@ZQuery(listQuerySchema) query: ListQuery): Promise<Paginated<StaffUserView>> {
    return this.users.list(query);
  }

  @Post()
  @RequirePermissions('user.manage')
  create(@ZBody(staffUserCreateSchema) input: StaffUserCreateInput): Promise<StaffUserView> {
    return this.users.create(input);
  }

  @Put(':id')
  @RequirePermissions('user.manage')
  update(
    @UuidParam() id: string,
    @ZBody(staffUserUpdateSchema) input: StaffUserUpdateInput,
    @CurrentUser() actor: AuthContext,
  ): Promise<StaffUserView> {
    return this.users.update(id, input, actor);
  }
}
