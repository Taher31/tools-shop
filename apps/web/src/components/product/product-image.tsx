import { cn } from '@toolshop/ui';
import { Package } from 'lucide-react';
import Image from 'next/image';

/** Product photo with a neutral fallback; SVG placeholders bypass the optimizer. */
export function ProductImage({
  src,
  alt,
  sizes = '(max-width: 768px) 50vw, 25vw',
  priority = false,
  className,
}: {
  src: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          'text-muted-foreground/40 flex size-full items-center justify-center',
          className,
        )}
      >
        <Package className="size-1/3" strokeWidth={1.2} />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={src.endsWith('.svg')}
      className={cn('object-contain p-3', className)}
    />
  );
}
