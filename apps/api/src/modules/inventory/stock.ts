import type { StockAvailability } from '@toolshop/shared';

export interface LevelLike {
  onHand: number;
  reserved: number;
}

/** Sellable quantity across warehouses (never negative per warehouse). */
export function availableQuantity(levels: readonly LevelLike[]): number {
  return levels.reduce((sum, level) => sum + Math.max(0, level.onHand - level.reserved), 0);
}

export function stockTotals(levels: readonly LevelLike[]): {
  onHand: number;
  reserved: number;
  available: number;
} {
  return {
    onHand: levels.reduce((sum, level) => sum + level.onHand, 0),
    reserved: levels.reduce((sum, level) => sum + level.reserved, 0),
    available: availableQuantity(levels),
  };
}

export function availabilityOf(available: number, lowStockThreshold: number): StockAvailability {
  if (available <= 0) return 'out_of_stock';
  if (available <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}
