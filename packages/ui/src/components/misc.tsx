import * as React from 'react';
import { cn } from '../lib/cn';

export function Separator({
  className,
  vertical = false,
}: {
  className?: string;
  vertical?: boolean;
}) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cn('bg-border shrink-0', vertical ? 'h-full w-px' : 'h-px w-full', className)}
    />
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-muted animate-pulse rounded-md', className)} {...props} />;
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? <div className="text-muted-foreground [&_svg]:size-10">{icon}</div> : null}
      <p className="text-base font-bold">{title}</p>
      {description ? (
        <div className="text-muted-foreground max-w-md text-sm leading-7">{description}</div>
      ) : null}
      {action}
    </div>
  );
}

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: 'info' | 'success' | 'warning' | 'destructive';
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: 'border-info/30 bg-info-soft text-info',
    success: 'border-success/30 bg-success-soft text-success',
    warning: 'border-warning/30 bg-warning-soft text-warning',
    destructive: 'border-destructive/30 bg-destructive-soft text-destructive',
  }[variant];
  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn('rounded-md border px-4 py-3 text-sm leading-7', styles, className)}
    >
      {title ? <p className="font-bold">{title}</p> : null}
      {children ? <div className="text-foreground/85">{children}</div> : null}
    </div>
  );
}
