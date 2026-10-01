import { Star } from 'lucide-react';
import { faNumber } from '@/lib/format';

export function RatingSummary({ average, count }: { average: number | null; count: number }) {
  if (!average || count === 0) return null;
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <Star className="fill-accent text-accent size-3.5" />
      <span className="text-foreground font-semibold">
        {faNumber(Math.round(average * 10) / 10)}
      </span>
      <span>({faNumber(count)})</span>
    </span>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className} aria-label={`${value} از ۵`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          className={`inline size-4 ${index <= Math.round(value) ? 'fill-accent text-accent' : 'text-border'}`}
        />
      ))}
    </span>
  );
}
