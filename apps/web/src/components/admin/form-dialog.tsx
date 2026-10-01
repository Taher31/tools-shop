'use client';

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@toolshop/ui';
import type { FormEvent, ReactNode } from 'react';

/** Modal form used by the admin CRUD screens. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
  loading,
  submitLabel = 'ذخیره',
  wide = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading?: boolean;
  submitLabel?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={wide ? 'max-w-3xl' : 'max-w-xl'} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" loading={loading}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
