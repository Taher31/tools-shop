'use client';

import type { ProductImage as ProductImageData } from '@toolshop/shared';
import { cn } from '@toolshop/ui';
import { useState } from 'react';
import { ProductImage } from './product-image';

export function ProductGallery({ images, title }: { images: ProductImageData[]; title: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];
  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-gradient-to-b from-muted/30 to-muted/80">
        <ProductImage src={current?.url ?? null} alt={current?.alt ?? title} priority sizes="(max-width: 1024px) 100vw, 40vw" className="p-8" />
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                'relative size-16 shrink-0 rounded-md border bg-muted',
                index === active ? 'border-primary ring-2 ring-primary/20' : 'border-border',
              )}
              aria-label={`تصویر ${index + 1}`}
            >
              <ProductImage src={image.url} alt="" sizes="64px" className="p-1" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
