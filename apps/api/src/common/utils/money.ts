/** Converts a database BigInt (Rial) to a JS number, failing loudly if it is not safe. */
export function toRial(value: bigint): number;
export function toRial(value: bigint | null | undefined): number | null;
export function toRial(value: bigint | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`Amount ${value} exceeds the safe integer range`);
  }
  return Number(value);
}

export function toBigInt(value: number): bigint;
export function toBigInt(value: number | null | undefined): bigint | null;
export function toBigInt(value: number | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  return BigInt(Math.trunc(value));
}
