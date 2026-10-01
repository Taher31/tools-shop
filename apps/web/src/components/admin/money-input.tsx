'use client';

import { Input } from '@toolshop/ui';
import { forwardRef } from 'react';
import { toEnglishDigits } from '@toolshop/shared';

/**
 * Price input in Toman (what staff think in). The value it reports is Rial – the unit the
 * API and database use – so no conversion logic leaks into forms.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  {
    value: number | null | undefined;
    onChange: (rial: number | null) => void;
    id?: string;
    placeholder?: string;
    'aria-invalid'?: boolean;
  }
>(({ value, onChange, ...props }, ref) => {
  const toman =
    value === null || value === undefined
      ? ''
      : new Intl.NumberFormat('en-US').format(Math.floor(value / 10));
  return (
    <div className="relative">
      <Input
        ref={ref}
        inputMode="numeric"
        dir="ltr"
        className="pl-14 text-left"
        value={toman}
        onChange={(event) => {
          const digits = toEnglishDigits(event.target.value).replace(/[^\d]/g, '');
          onChange(digits ? Number(digits) * 10 : null);
        }}
        {...props}
      />
      <span className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs">
        تومان
      </span>
    </div>
  );
});
MoneyInput.displayName = 'MoneyInput';
