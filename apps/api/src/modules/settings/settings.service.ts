import { Injectable } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import {
  type CommerceSettings,
  type LegalSettings,
  type PublicSettings,
  SETTINGS_GROUPS,
  type SettingsGroup,
  type StoreSettings,
} from '@toolshop/shared';
import type { z } from 'zod';
import { CacheService } from '../../infrastructure/redis/cache.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type SettingsValue<G extends SettingsGroup> = z.output<(typeof SETTINGS_GROUPS)[G]>;

export interface AllSettings {
  store: StoreSettings;
  legal: LegalSettings;
  commerce: CommerceSettings;
}

const CACHE_KEY = 'settings:all';

/** Key/value settings stored in the database, validated by the shared zod schemas. */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
  ) {}

  async getAll(): Promise<AllSettings> {
    return this.cache.wrap(CACHE_KEY, 300, async () => {
      const rows = await this.prisma.setting.findMany({ where: { key: { in: Object.keys(SETTINGS_GROUPS) } } });
      const values = new Map(rows.map((row) => [row.key, row.value]));
      return {
        store: this.parse('store', values.get('store')),
        legal: this.parse('legal', values.get('legal')),
        commerce: this.parse('commerce', values.get('commerce')),
      };
    });
  }

  async get<G extends SettingsGroup>(group: G): Promise<SettingsValue<G>> {
    return (await this.getAll())[group] as SettingsValue<G>;
  }

  async getPublic(): Promise<PublicSettings> {
    const all = await this.getAll();
    return {
      store: all.store,
      legal: all.legal,
      commerce: {
        displayCurrency: all.commerce.displayCurrency,
        pricesIncludeTax: all.commerce.pricesIncludeTax,
        taxRatePercent: all.commerce.taxRatePercent,
      },
    };
  }

  async update<G extends SettingsGroup>(group: G, value: SettingsValue<G>): Promise<SettingsValue<G>> {
    const before = await this.get(group);
    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: group },
        update: { value: value as Prisma.InputJsonValue },
        create: { key: group, value: value as Prisma.InputJsonValue },
      });
      await this.audit.record(
        {
          action: 'settings.update',
          entityType: 'settings',
          entityId: group,
          summary: `تغییر تنظیمات ${group}`,
          before: before as Record<string, unknown>,
          after: value as Record<string, unknown>,
        },
        tx,
      );
    });
    await this.cache.del(CACHE_KEY);
    return value;
  }

  private parse<G extends SettingsGroup>(group: G, raw: unknown): SettingsValue<G> {
    const schema = SETTINGS_GROUPS[group];
    const result = schema.safeParse(raw ?? {});
    if (result.success) return result.data as SettingsValue<G>;
    // Stored data predates a schema change: fall back to defaults merged with valid fields.
    return schema.parse({ ...(schema.safeParse({}).data ?? {}), ...(raw as object) }) as SettingsValue<G>;
  }
}
