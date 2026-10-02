import { Get } from '@nestjs/common';
import {
  type AuditLogQuery,
  auditLogQuerySchema,
  type AuditLogView,
  type Paginated,
} from '@toolshop/shared';
import type { Prisma } from '@toolshop/database';
import { dayRange } from '../../common/utils/filters';
import { ZQuery } from '../../common/decorators/validated.decorator';
import { paginate, paginationArgs } from '../../common/utils/pagination';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AdminController, RequirePermissions } from '../auth/decorators';

@AdminController('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit.read')
  async list(@ZQuery(auditLogQuerySchema) query: AuditLogQuery): Promise<Paginated<AuditLogView>> {
    const where: Prisma.AuditLogWhereInput = {
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
      actorType: query.actorType,
      action: query.action ? { startsWith: query.action } : undefined,
      createdAt: dayRange(query),
      ...(query.q ? { summary: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, firstName: true, lastName: true } } },
        ...paginationArgs(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(
      rows.map((row) => ({
        id: row.id,
        actorType: row.actorType,
        actor: row.actor
          ? { id: row.actor.id, fullName: `${row.actor.firstName} ${row.actor.lastName}` }
          : null,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        summary: row.summary,
        before: row.before,
        after: row.after,
        ipAddress: row.ipAddress,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }
}
