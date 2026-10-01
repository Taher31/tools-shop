import { Wrench } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@toolshop/ui';

/**
 * Placeholder logo: monogram + store name from settings. Replace this component (or set
 * a logo URL in Admin → Settings) once the final brand identity exists.
 */
export function BrandLogo({
  name,
  logoUrl,
  tagline,
  className,
  inverted = false,
}: {
  name: string;
  logoUrl?: string | null;
  tagline?: string | null;
  className?: string;
  inverted?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn('flex shrink-0 items-center gap-2.5', className)}
      aria-label={`${name} – صفحه اصلی`}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} className="h-10 w-auto" />
      ) : (
        <>
          <span className="bg-primary text-accent flex size-10 items-center justify-center rounded-md shadow-inner">
            <Wrench className="size-5" strokeWidth={2.4} />
          </span>
          <span className="flex flex-col leading-tight">
            <span
              className={cn(
                'text-lg font-extrabold tracking-tight',
                inverted ? 'text-white' : 'text-primary',
              )}
            >
              {name}
            </span>
            {tagline ? (
              <span
                className={cn(
                  'hidden text-[11px] sm:block',
                  inverted ? 'text-white/60' : 'text-muted-foreground',
                )}
              >
                {tagline}
              </span>
            ) : null}
          </span>
        </>
      )}
    </Link>
  );
}
