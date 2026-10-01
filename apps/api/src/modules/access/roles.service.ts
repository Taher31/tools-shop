import { Injectable } from '@nestjs/common';
import {
  isPermission,
  PERMISSION_DEFINITIONS,
  type Permission,
  type PermissionDefinition,
  type RoleUpsertInput,
  type RoleView,
  SUPER_ADMIN_ROLE,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PrincipalService } from '../auth/principal.service';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly principals: PrincipalService,
  ) {}

  permissionCatalog(): readonly PermissionDefinition[] {
    return PERMISSION_DEFINITIONS;
  }

  async list(): Promise<RoleView[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      include: { permissions: true, _count: { select: { users: true } } },
    });
    return roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((p) => p.permissionKey).filter(isPermission),
      usersCount: role._count.users,
    }));
  }

  async create(input: RoleUpsertInput): Promise<RoleView> {
    const permissions = this.validatePermissions(input.permissions);
    const role = await this.prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          key: input.key,
          name: input.name,
          description: input.description,
          permissions: { create: permissions.map((permissionKey) => ({ permissionKey })) },
        },
      });
      await this.audit.record(
        {
          action: 'role.create',
          entityType: 'role',
          entityId: created.id,
          summary: `ایجاد نقش ${created.name}`,
          after: { key: created.key, permissions },
        },
        tx,
      );
      return created;
    });
    return this.getOrThrow(role.id);
  }

  async update(id: string, input: RoleUpsertInput): Promise<RoleView> {
    const existing = await this.prisma.role.findUnique({ where: { id }, include: { permissions: true } });
    if (!existing) throw AppException.notFound('نقش یافت نشد.');
    if (existing.key === SUPER_ADMIN_ROLE) throw AppException.forbidden('نقش مدیر ارشد قابل ویرایش نیست.');
    const permissions = this.validatePermissions(input.permissions);

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: { name: input.name, description: input.description, key: existing.isSystem ? existing.key : input.key },
      });
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({ data: permissions.map((permissionKey) => ({ roleId: id, permissionKey })) });
      await this.audit.record(
        {
          action: 'role.update',
          entityType: 'role',
          entityId: id,
          summary: `ویرایش دسترسی‌های نقش ${input.name}`,
          before: { name: existing.name, permissions: existing.permissions.map((p) => p.permissionKey).sort() },
          after: { name: input.name, permissions: [...permissions].sort() },
        },
        tx,
      );
    });
    await this.principals.invalidateAll();
    return this.getOrThrow(id);
  }

  async remove(id: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!role) throw AppException.notFound('نقش یافت نشد.');
    if (role.isSystem) throw AppException.forbidden('نقش‌های سیستمی قابل حذف نیستند.');
    if (role._count.users > 0) throw AppException.conflict('این نقش به کاربرانی اختصاص داده شده است.');
    await this.prisma.$transaction(async (tx) => {
      await tx.role.delete({ where: { id } });
      await this.audit.record(
        { action: 'role.delete', entityType: 'role', entityId: id, summary: `حذف نقش ${role.name}` },
        tx,
      );
    });
  }

  private async getOrThrow(id: string): Promise<RoleView> {
    const role = (await this.list()).find((item) => item.id === id);
    if (!role) throw AppException.notFound();
    return role;
  }

  private validatePermissions(values: string[]): Permission[] {
    const unknown = values.filter((value) => !isPermission(value));
    if (unknown.length > 0) {
      throw AppException.validation([{ path: 'permissions', message: `دسترسی نامعتبر: ${unknown.join(', ')}` }]);
    }
    return [...new Set(values)] as Permission[];
  }
}
