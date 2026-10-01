import type { ProductCard as ProductCardData } from '@toolshop/shared';
import { Badge, cn } from '@toolshop/ui';
import Link from 'next/link';
import { PriceTag } from './price-tag';
import { ProductCardActions } from './product-card-actions';
import { ProductImage } from './product-image';
import { RatingSummary } from './rating';

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-lg hover:shadow-black/5">
      <Link href={`/product/${product.slug}`} className="relative block aspect-square bg-gradient-to-b from-muted/40 to-muted/80">
        <ProductImage src={product.imageUrl} alt={product.title} priority={priority} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        {!product.inStock ? (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/75 py-1 text-center text-xs font-medium text-white">ناموجود</span>
        ) : null}
      </Link>
      <ProductCardActions productId={product.id} />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex min-h-5 items-center justify-between gap-2">
          {product.brand ? (
            <Link href={`/brand/${product.brand.slug}`} className="truncate text-xs font-medium text-info hover:underline">
              {product.brand.name}
            </Link>
          ) : (
            <span />
          )}
          <RatingSummary average={product.ratingAverage} count={product.ratingCount} />
        </div>
        <h3 className="line-clamp-2 min-h-[3rem] text-sm font-semibold leading-6">
          <Link href={`/product/${product.slug}`} className="hover:text-primary">
            {product.title}
          </Link>
        </h3>
        {product.keySpecs.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {product.keySpecs.slice(0, 3).map((spec) => (
              <li key={spec.label}>
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  {spec.value}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <div className={cn('mt-auto flex items-end justify-between pt-1', !product.inStock && 'opacity-60')}>
          {product.variantCount > 1 ? <span className="text-[11px] text-muted-foreground">شروع قیمت از</span> : <span />}
          {product.inStock ? (
            <PriceTag price={product.price} compareAtPrice={product.compareAtPrice} discountPercent={product.discountPercent} />
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">ناموجود</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, className }: { products: ProductCardData[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4', className)}>
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 4} />
      ))}
    </div>
  );
}
