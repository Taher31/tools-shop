import { Injectable } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import {
  type ListQuery,
  type Paginated,
  type StaffUserCreateInput,
  type StaffUserUpdateInput,
  type StaffUserView,
  SUPER_ADMIN_ROLE,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { paginate, paginationArgs } from '../../common/utils/pagination';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { PasswordService } from '../auth/password.service';
import { PrincipalService } from '../auth/principal.service';
import { SessionService } from '../auth/session.service';

const STAFF_INCLUDE = { roles: { include: { role: { select: { id: true, key: true, name: true } } } } } as const;
type StaffRecord = Prisma.UserGetPayload<{ include: typeof STAFF_INCLUDE }>;

function toView(user: StaffRecord): StaffUserView {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    email: user.email,
    mobile: user.mobile,
    isActive: user.isActive,
    roles: user.roles.map((entry) => entry.role),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class StaffUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly principals: PrincipalService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListQuery): Promise<Paginated<StaffUserView>> {
    const where: Prisma.UserWhereInput = {
      type: 'staff',
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, include: STAFF_INCLUDE, orderBy: { createdAt: 'asc' }, ...paginationArgs(query) }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(users.map(toView), total, query);
  }

  async create(input: StaffUserCreateInput): Promise<StaffUserView> {
    await this.assertRolesExist(input.roleIds);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          type: 'staff',
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          mobile: input.mobile ?? null,
          isActive: input.isActive,
          passwordHash: await this.passwords.hash(input.password),
          roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
        },
        include: STAFF_INCLUDE,
      });
      await this.audit.record(
        {
          action: 'user.create',
          entityType: 'user',
          entityId: created.id,
          summary: `ایجاد کاربر مدیریتی ${created.email}`,
          after: { email: created.email, roles: created.roles.map((r) => r.role.key) },
        },
        tx,
      );
      return created;
    });
    return toView(user);
  }

  async update(id: string, input: StaffUserUpdateInput, actor: AuthContext): Promise<StaffUserView> {
    const existing = await this.prisma.user.findFirst({ where: { id, type: 'staff' }, include: STAFF_INCLUDE });
    if (!existing) throw AppException.notFound('کاربر یافت نشد.');
    await this.assertRolesExist(input.roleIds);
    if (id === actor.userId && !input.isActive) throw AppException.forbidden('نمی‌توانید حساب خود را غیرفعال کنید.');

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      const updated = await tx.user.update({
        where: { id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          isActive: input.isActive,
          ...(input.password ? { passwordHash: await this.passwords.hash(input.password) } : {}),
          roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
        },
        include: STAFF_INCLUDE,
      });
      await this.assertSuperAdminRemains(tx);
      await this.audit.record(
        {
          action: 'user.update',
          entityType: 'user',
          entityId: id,
          summary: `ویرایش کاربر مدیریتی ${existing.email}`,
          before: { isActive: existing.isActive, roles: existing.roles.map((r) => r.role.key).sort() },
          after: {
            isActive: updated.isActive,
            roles: updated.roles.map((r) => r.role.key).sort(),
            ...(input.password ? { password: 'changed' } : {}),
          },
        },
        tx,
      );
      return updated;
    });

    await this.principals.invalidate(id);
    if (!input.isActive || input.password) await this.sessions.revokeAllForUser(id);
    return toView(user);
  }

  private async assertRolesExist(roleIds: string[]): Promise<void> {
    const count = await this.prisma.role.count({ where: { id: { in: roleIds } } });
    if (count !== new Set(roleIds).size) {
      throw AppException.validation([{ path: 'roleIds', message: 'نقش انتخاب‌شده معتبر نیست.' }]);
    }
  }

  private async assertSuperAdminRemains(tx: Tx): Promise<void> {
    const remaining = await tx.user.count({
      where: { type: 'staff', isActive: true, roles: { some: { role: { key: SUPER_ADMIN_ROLE } } } },
    });
    if (remaining === 0) throw AppException.conflict('حداقل یک مدیر ارشد فعال باید وجود داشته باشد.');
  }
}
