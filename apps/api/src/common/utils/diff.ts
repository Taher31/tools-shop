type Plain = Record<string, unknown>;

function normalize(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return (value as { toNumber(): number }).toNumber();
  }
  return value;
}

/**
 * Returns only the keys whose values differ between two snapshots – what the audit log
 * stores as before/after. Values are made JSON-safe (BigInt, Date, Decimal).
 */
export function diffSnapshots(before: Plain | null | undefined, after: Plain | null | undefined): {
  before: Plain | null;
  after: Plain | null;
} {
  if (!before || !after) {
    return { before: before ? sanitize(before) : null, after: after ? sanitize(after) : null };
  }
  const changedBefore: Plain = {};
  const changedAfter: Plain = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = normalize(before[key]);
    const b = normalize(after[key]);
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changedBefore[key] = a;
      changedAfter[key] = b;
    }
  }
  return { before: changedBefore, after: changedAfter };
}

export function sanitize(snapshot: Plain): Plain {
  return Object.fromEntries(Object.entries(snapshot).map(([key, value]) => [key, normalize(value)]));
}

export function pick<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) result[key] = source[key];
  return result;
}
