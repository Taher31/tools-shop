import type { ProductSpec } from '@toolshop/shared';

/** Technical specifications grouped by attribute group. */
export function SpecTable({ specs }: { specs: ProductSpec[] }) {
  const groups = new Map<string, ProductSpec[]>();
  for (const spec of specs) {
    const key = spec.group ?? 'مشخصات';
    groups.set(key, [...(groups.get(key) ?? []), spec]);
  }
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([group, items]) => (
        <section key={group}>
          <h3 className="text-primary mb-2 text-sm font-bold">{group}</h3>
          <dl className="border-border overflow-hidden rounded-md border">
            {items.map((spec, index) => (
              <div
                key={spec.attributeId}
                className={`grid grid-cols-[minmax(8rem,14rem)_1fr] text-sm ${index % 2 ? 'bg-card' : 'bg-muted/50'}`}
              >
                <dt className="border-border text-muted-foreground border-e px-4 py-2.5">
                  {spec.name}
                </dt>
                <dd className="px-4 py-2.5 font-medium">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
