import { Injectable, Logger } from '@nestjs/common';
import type { AuditActorType, Prisma } from '@toolshop/database';
import { RequestContext } from '../../common/http/request-context';
import { diffSnapshots } from '../../common/utils/diff';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** Defaults to the authenticated user of the current request, or `system`. */
  actorType?: AuditActorType;
  actorId?: string | null;
}

/**
 * Append-only audit trail for sensitive operations (prices, stock, orders, refunds,
 * roles, settings, AI configuration). Only changed fields are stored for updates.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: Tx): Promise<void> {
    const context = RequestContext.get();
    const hasSnapshots = entry.before !== undefined || entry.after !== undefined;
    const { before, after } = diffSnapshots(entry.before, entry.after);
    if (hasSnapshots && entry.before && entry.after && before && Object.keys(before).length === 0) return;

    const actorId = entry.actorId !== undefined ? entry.actorId : (context?.user?.userId ?? null);
    const actorType: AuditActorType = entry.actorType ?? (actorId ? 'user' : 'system');
    const data: Prisma.AuditLogUncheckedCreateInput = {
      actorType,
      actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary ?? null,
      before: (before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      requestId: context?.requestId ?? null,
    };
    const client = tx ?? this.prisma;
    try {
      await client.auditLog.create({ data });
    } catch (error) {
      // Inside a transaction the failure must abort the operation; outside, never lose the request.
      if (tx) throw error;
      this.logger.error({ err: error, action: entry.action }, 'Failed to write audit log');
    }
  }
}
