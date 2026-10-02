import { Injectable } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import type { AiFeature, AiSettings, AiUsageSummary } from '@toolshop/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { startOfJalaliMonth, tehranDateKey } from '../dashboard/tehran-time';
import { AiUnavailableError } from './ai-errors';
import { costMicros, type PriceOverride, tokenUsage } from './pricing';

/** Token accounting and the monthly budget (Jalali month, Tehran time). */
@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    feature: AiFeature,
    model: string,
    message: Pick<Anthropic.Beta.BetaMessage, 'usage' | 'stop_reason'>,
    conversationId: string | null = null,
    pricing: PriceOverride | null = null,
  ): Promise<void> {
    const usage = tokenUsage(message.usage);
    await this.prisma.aiUsage.create({
      data: {
        feature,
        model,
        ...usage,
        costMicros: BigInt(costMicros(model, usage, pricing)),
        stopReason: message.stop_reason,
        conversationId,
      },
    });
  }

  async spentThisMonthUsd(): Promise<number> {
    const result = await this.prisma.aiUsage.aggregate({
      where: { createdAt: { gte: startOfJalaliMonth() } },
      _sum: { costMicros: true },
    });
    return Number(result._sum.costMicros ?? 0n) / 1_000_000;
  }

  async assertWithinBudget(settings: AiSettings): Promise<void> {
    if ((await this.spentThisMonthUsd()) >= settings.monthlyBudgetUsd) {
      throw new AiUnavailableError('budget', 'سقف بودجه ماهانه هوش مصنوعی تکمیل شده است.');
    }
  }

  async summary(budgetUsd: number): Promise<AiUsageSummary> {
    const monthStart = startOfJalaliMonth();
    const rows = await this.prisma.aiUsage.findMany({
      where: { createdAt: { gte: monthStart } },
      select: {
        feature: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        costMicros: true,
        stopReason: true,
        createdAt: true,
      },
    });
    const byFeature = new Map<string, { requests: number; costMicros: number }>();
    const daily = new Map<string, { requests: number; costMicros: number }>();
    let cost = 0;
    let input = 0;
    let output = 0;
    let cacheRead = 0;
    let refusals = 0;
    for (const row of rows) {
      const micros = Number(row.costMicros);
      cost += micros;
      input += row.inputTokens;
      output += row.outputTokens;
      cacheRead += row.cacheReadTokens;
      if (row.stopReason === 'refusal') refusals += 1;
      const feature = byFeature.get(row.feature) ?? { requests: 0, costMicros: 0 };
      feature.requests += 1;
      feature.costMicros += micros;
      byFeature.set(row.feature, feature);
      const key = tehranDateKey(row.createdAt);
      const day = daily.get(key) ?? { requests: 0, costMicros: 0 };
      day.requests += 1;
      day.costMicros += micros;
      daily.set(key, day);
    }
    const usd = (micros: number) => Math.round(micros / 10_000) / 100;
    return {
      monthStart: monthStart.toISOString(),
      costUsd: usd(cost),
      budgetUsd,
      requests: rows.length,
      inputTokens: input,
      outputTokens: output,
      cacheReadTokens: cacheRead,
      refusals,
      byFeature: [...byFeature.entries()].map(([feature, value]) => ({
        feature: feature as AiFeature,
        requests: value.requests,
        costUsd: usd(value.costMicros),
      })),
      daily: [...daily.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({
          date,
          requests: value.requests,
          costUsd: usd(value.costMicros),
        })),
    };
  }
}
