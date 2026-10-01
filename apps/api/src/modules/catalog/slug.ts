import { slugify } from '@toolshop/shared';

/** Returns `base`, or `base-2`, `base-3`... — the first slug not already taken. */
export async function uniqueSlug(
  source: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(source).slice(0, 150) || 'item';
  let candidate = base;
  for (let suffix = 2; await isTaken(candidate); suffix += 1) {
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}
