'use client';

import { Button, cn, Spinner } from '@toolshop/ui';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

/** Small "generate with AI" trigger with a consistent look across admin pages. */
export function AiButton({
  onClick,
  pending,
  children,
  className,
}: {
  onClick: () => void;
  pending: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={pending}
      className={cn(
        'border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-500/10',
        className,
      )}
    >
      {pending ? <Spinner /> : <Sparkles />}
      {children}
    </Button>
  );
}

/** Confidence pill: how well the store's own data supports an AI draft. */
export function ConfidenceBadge({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  const tone =
    value >= 0.85
      ? 'bg-success-soft text-success'
      : value >= 0.6
        ? 'bg-warning-soft text-warning'
        : 'bg-destructive/10 text-destructive';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', tone)}>
      اطمینان {percent.toLocaleString('fa-IR')}٪
    </span>
  );
}

/** Note shown under an AI draft: it is a suggestion that a person must review. */
export function AiDraftNote({ confidence, notes }: { confidence: number; notes: string | null }) {
  return (
    <div className="space-y-1 rounded-md border border-violet-200 bg-violet-50/60 p-3 text-xs leading-6 dark:border-violet-500/30 dark:bg-violet-500/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 font-bold text-violet-700 dark:text-violet-300">
          <Sparkles className="size-3.5" /> پیش‌نویس هوش مصنوعی
        </span>
        <ConfidenceBadge value={confidence} />
      </div>
      <p className="text-muted-foreground">
        {notes ? `${notes} · ` : ''}قبل از ارسال، متن را بازبینی و در صورت نیاز ویرایش کنید.
      </p>
    </div>
  );
}
