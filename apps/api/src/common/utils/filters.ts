import { tehranDayRange } from '@toolshop/shared';

/** Inclusive Tehran-day range from admin list filters → Prisma DateTime filter. */
export function dayRange(query: { from?: string; to?: string }) {
  return tehranDayRange(query.from, query.to);
}

/** Toman bounds from admin filters → Prisma BigInt (Rial) filter. */
export function rialRange(min?: number, max?: number): { gte?: bigint; lte?: bigint } | undefined {
  if (min === undefined && max === undefined) return undefined;
  return {
    ...(min !== undefined ? { gte: BigInt(min) * 10n } : {}),
    ...(max !== undefined ? { lte: BigInt(max) * 10n } : {}),
  };
}
