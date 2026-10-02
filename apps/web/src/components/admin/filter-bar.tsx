'use client';

import { Button, cn, Input, NativeSelect } from '@toolshop/ui';
import { FilterX, SlidersHorizontal, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { SearchInput } from '@/components/admin/data-table';
import { DateRangeFilter, dateRangeLabel } from '@/components/admin/date-range-filter';
import type { UrlList } from '@/components/admin/query';
import { faNumber } from '@/lib/format';

export interface Option {
  value: string;
  label: string;
}

export type FilterDef =
  | { type: 'select'; key: string; label: string; options: Option[]; allLabel?: string }
  | { type: 'range'; label: string; minKey: string; maxKey: string; unit?: string };

/** Number input that commits on blur/Enter, so typing does not refetch every keystroke. */
function CommitNumber({
  value,
  onCommit,
  placeholder,
  label,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  // Remounted (via key) when the committed value changes from outside.
  const [text, setText] = useState(value);
  const commit = () => {
    const digits = text
      .replace(/[^\d۰-۹]/g, '')
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    if (digits !== value) onCommit(digits);
  };
  return (
    <Input
      inputMode="numeric"
      dir="ltr"
      className="h-9 text-left"
      value={text}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}

const str = (value: unknown) => (value === undefined || value === null ? '' : String(value));

/**
 * Toolbar for admin lists: search, Jalali date range, the main filters inline, the rest
 * behind "more filters", sorting, active-filter chips and a one-click reset. All state
 * lives in the URL through `useUrlList`.
 */
export function FilterBar({
  list,
  searchPlaceholder,
  dateLabel,
  inline = [],
  more = [],
  sorts,
  actions,
}: {
  list: UrlList;
  searchPlaceholder?: string;
  /** Shows the date-range picker (e.g. "تاریخ ثبت"). */
  dateLabel?: string;
  inline?: FilterDef[];
  more?: FilterDef[];
  sorts?: Option[];
  actions?: ReactNode;
}) {
  const { params } = list;
  const activeMore = more.filter((f) =>
    f.type === 'select'
      ? str(params[f.key]) !== ''
      : str(params[f.minKey]) + str(params[f.maxKey]) !== '',
  ).length;
  const [showMore, setShowMore] = useState(activeMore > 0);

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (params.q)
    chips.push({
      key: 'q',
      label: `جستجو: ${str(params.q)}`,
      clear: () => list.update({ q: undefined }),
    });
  const range = dateRangeLabel({
    from: str(params.from) || undefined,
    to: str(params.to) || undefined,
  });
  if (range)
    chips.push({
      key: 'date',
      label: `${dateLabel ?? 'تاریخ'}: ${range}`,
      clear: () => list.update({ from: undefined, to: undefined }),
    });
  for (const f of [...inline, ...more]) {
    if (f.type === 'select') {
      const value = str(params[f.key]);
      const option = f.options.find((o) => o.value === value);
      if (option)
        chips.push({
          key: f.key,
          label: `${f.label}: ${option.label}`,
          clear: () => list.update({ [f.key]: undefined }),
        });
    } else {
      const min = str(params[f.minKey]);
      const max = str(params[f.maxKey]);
      if (min || max) {
        const unit = f.unit ? ` ${f.unit}` : '';
        const text =
          min && max
            ? `${faNumber(Number(min))} تا ${faNumber(Number(max))}${unit}`
            : min
              ? `از ${faNumber(Number(min))}${unit}`
              : `تا ${faNumber(Number(max))}${unit}`;
        chips.push({
          key: f.minKey,
          label: `${f.label}: ${text}`,
          clear: () => list.update({ [f.minKey]: undefined, [f.maxKey]: undefined }),
        });
      }
    }
  }

  const control = (f: FilterDef, compact: boolean) =>
    f.type === 'select' ? (
      <NativeSelect
        key={f.key}
        className={cn('h-9', compact ? 'w-auto min-w-36' : 'w-full')}
        value={str(params[f.key])}
        onChange={(e) => list.update({ [f.key]: e.target.value || undefined })}
        aria-label={f.label}
      >
        <option value="">{f.allLabel ?? `${f.label}: همه`}</option>
        {f.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    ) : (
      <div key={f.minKey} className="grid grid-cols-2 gap-2">
        <CommitNumber
          key={`min-${str(params[f.minKey])}`}
          value={str(params[f.minKey])}
          onCommit={(v) => list.update({ [f.minKey]: v || undefined })}
          placeholder="از"
          label={`${f.label} از`}
        />
        <CommitNumber
          key={`max-${str(params[f.maxKey])}`}
          value={str(params[f.maxKey])}
          onCommit={(v) => list.update({ [f.maxKey]: v || undefined })}
          placeholder="تا"
          label={`${f.label} تا`}
        />
      </div>
    );

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          onSearch={list.setSearch}
          defaultValue={str(params.q)}
          placeholder={searchPlaceholder}
          className="w-full sm:w-72"
        />
        {dateLabel ? (
          <DateRangeFilter
            label={dateLabel}
            value={{ from: str(params.from) || undefined, to: str(params.to) || undefined }}
            onChange={(r) => list.update({ from: r.from, to: r.to })}
          />
        ) : null}
        {inline.map((f) => control(f, true))}
        {more.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant={showMore ? 'secondary' : 'outline'}
            className="h-9"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
          >
            <SlidersHorizontal />
            فیلترهای بیشتر
            {activeMore > 0 ? (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[11px]">
                {faNumber(activeMore)}
              </span>
            ) : null}
          </Button>
        ) : null}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {sorts ? (
            <NativeSelect
              className="h-9 w-auto min-w-36"
              value={str(params.sort)}
              onChange={(e) => list.update({ sort: e.target.value || undefined })}
              aria-label="مرتب‌سازی"
            >
              {sorts.map((o) => (
                <option key={o.value} value={o.value}>
                  مرتب‌سازی: {o.label}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          {actions}
        </div>
      </div>
      {showMore && more.length > 0 ? (
        <div className="bg-muted/40 grid gap-3 rounded-lg p-3 sm:grid-cols-2 lg:grid-cols-4">
          {more.map((f) => (
            <label key={f.type === 'select' ? f.key : f.minKey} className="space-y-1">
              <span className="text-muted-foreground text-xs font-semibold">
                {f.label}
                {f.type === 'range' && f.unit ? ` (${f.unit})` : ''}
              </span>
              {control(f, false)}
            </label>
          ))}
        </div>
      ) : null}
      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="فیلترهای فعال">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="bg-primary/10 text-primary inline-flex max-w-full items-center gap-1 rounded-full py-1 pe-1 ps-3 text-xs font-semibold"
            >
              <span className="truncate">{chip.label}</span>
              <button
                type="button"
                onClick={chip.clear}
                className="hover:bg-primary/20 rounded-full p-0.5"
                aria-label={`حذف فیلتر ${chip.label}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => list.reset()}
          >
            <FilterX /> حذف همه فیلترها
          </Button>
        </div>
      ) : null}
    </div>
  );
}
