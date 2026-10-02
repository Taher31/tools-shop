'use client';

import {
  addDaysToKey,
  dateKeyToJalali,
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  jalaliMonthLength,
  jalaliToDateKey,
  tehranDateKey,
} from '@toolshop/shared';
import { Button, cn, Popover, PopoverContent, PopoverTrigger } from '@toolshop/ui';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { faNumber } from '@/lib/format';

export interface DateRange {
  from?: string;
  to?: string;
}

const shortLabel = (key: string) => {
  const { jy, jm, jd } = dateKeyToJalali(key);
  return `${faNumber(jd)} ${JALALI_MONTHS[jm - 1]} ${faNumber(String(jy))}`;
};

export function dateRangeLabel({ from, to }: DateRange): string | null {
  if (!from && !to) return null;
  if (from && to)
    return from === to ? shortLabel(from) : `${shortLabel(from)} تا ${shortLabel(to)}`;
  return from ? `از ${shortLabel(from)}` : `تا ${shortLabel(to as string)}`;
}

function presets(today: string): { label: string; range: Required<DateRange> }[] {
  const { jy, jm } = dateKeyToJalali(today);
  const prev = jm === 1 ? { jy: jy - 1, jm: 12 } : { jy, jm: jm - 1 };
  return [
    { label: 'امروز', range: { from: today, to: today } },
    { label: 'دیروز', range: { from: addDaysToKey(today, -1), to: addDaysToKey(today, -1) } },
    { label: '۷ روز اخیر', range: { from: addDaysToKey(today, -6), to: today } },
    { label: '۳۰ روز اخیر', range: { from: addDaysToKey(today, -29), to: today } },
    { label: 'این ماه', range: { from: jalaliToDateKey({ jy, jm, jd: 1 }), to: today } },
    {
      label: 'ماه گذشته',
      range: {
        from: jalaliToDateKey({ ...prev, jd: 1 }),
        to: jalaliToDateKey({ ...prev, jd: jalaliMonthLength(prev.jy, prev.jm) }),
      },
    },
    { label: 'امسال', range: { from: jalaliToDateKey({ jy, jm: 1, jd: 1 }), to: today } },
  ];
}

/** Jalali month grid with range selection (first click = start, second = end). */
function MonthGrid({
  jy,
  jm,
  draft,
  hover,
  today,
  onPick,
  onHover,
}: {
  jy: number;
  jm: number;
  draft: DateRange;
  hover: string | null;
  today: string;
  onPick: (key: string) => void;
  onHover: (key: string | null) => void;
}) {
  const first = jalaliToDateKey({ jy, jm, jd: 1 });
  // Saturday-first offset of the 1st of the month.
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 1) % 7;
  const days = jalaliMonthLength(jy, jm);
  const end = draft.to ?? (draft.from && hover && hover > draft.from ? hover : undefined);
  return (
    <div
      className="grid grid-cols-7 gap-y-1 text-center text-sm"
      onMouseLeave={() => onHover(null)}
    >
      {JALALI_WEEKDAYS.map((day) => (
        <span key={day} className="text-muted-foreground py-1 text-xs">
          {day}
        </span>
      ))}
      {Array.from({ length: offset }, (_, i) => (
        <span key={`e${i}`} />
      ))}
      {Array.from({ length: days }, (_, i) => {
        const key = jalaliToDateKey({ jy, jm, jd: i + 1 });
        const isStart = key === draft.from;
        const isEnd = key === end;
        const inside = draft.from && end ? key > draft.from && key < end : false;
        const future = key > today;
        return (
          <button
            key={key}
            type="button"
            disabled={future}
            onClick={() => onPick(key)}
            onMouseEnter={() => onHover(key)}
            aria-pressed={isStart || isEnd}
            aria-label={shortLabel(key)}
            className={cn(
              'mx-auto flex size-9 items-center justify-center rounded-md transition-colors disabled:opacity-30',
              inside && 'bg-primary/10 rounded-none',
              isStart || isEnd ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-muted',
              key === today && !isStart && !isEnd && 'ring-primary/50 ring-1',
            )}
          >
            {faNumber(i + 1)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Date-range filter in the Jalali calendar with quick presets. Values are Gregorian
 * "YYYY-MM-DD" keys of Tehran calendar days, which the API turns into day boundaries.
 */
export function DateRangeFilter({
  value,
  onChange,
  label = 'تاریخ',
  className,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  label?: string;
  className?: string;
}) {
  const today = tehranDateKey();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const [hover, setHover] = useState<string | null>(null);
  const initial = dateKeyToJalali(value.to ?? value.from ?? today);
  const [month, setMonth] = useState({ jy: initial.jy, jm: initial.jm });
  const quick = useMemo(() => presets(today), [today]);
  const text = dateRangeLabel(value);

  const shift = (delta: number) =>
    setMonth(({ jy, jm }) => {
      const index = jy * 12 + (jm - 1) + delta;
      return { jy: Math.floor(index / 12), jm: (index % 12) + 1 };
    });

  const apply = (range: DateRange) => {
    onChange(range);
    setOpen(false);
  };

  const pick = (key: string) => {
    if (!draft.from || draft.to) {
      setDraft({ from: key });
      return;
    }
    const range = key < draft.from ? { from: key, to: draft.from } : { from: draft.from, to: key };
    setDraft(range);
    apply(range);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraft(value);
          const focus = dateKeyToJalali(value.to ?? value.from ?? today);
          setMonth({ jy: focus.jy, jm: focus.jm });
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('h-9 max-w-full justify-start', text && 'border-primary/50', className)}
        >
          <CalendarDays />
          <span className="truncate">{text ?? `${label}: همه`}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,calc(100vw-24px))] p-0">
        <div className="flex flex-col sm:flex-row">
          <ul className="border-border flex flex-wrap gap-1 border-b p-2 sm:w-36 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-e">
            {quick.map((preset) => (
              <li key={preset.label}>
                <button
                  type="button"
                  onClick={() => apply(preset.range)}
                  className={cn(
                    'hover:bg-muted w-full rounded-md px-2.5 py-1.5 text-start text-sm',
                    value.from === preset.range.from &&
                      value.to === preset.range.to &&
                      'bg-primary/10 text-primary font-semibold',
                  )}
                >
                  {preset.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex-1 space-y-2 p-3">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => shift(-1)}
                aria-label="ماه قبل"
              >
                <ChevronRight />
              </Button>
              <span className="text-sm font-bold">
                {JALALI_MONTHS[month.jm - 1]} {faNumber(String(month.jy))}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => shift(1)}
                aria-label="ماه بعد"
                disabled={jalaliToDateKey({ ...month, jd: 1 }) > today}
              >
                <ChevronLeft />
              </Button>
            </div>
            <MonthGrid
              {...month}
              draft={draft}
              hover={hover}
              today={today}
              onPick={pick}
              onHover={setHover}
            />
            <div className="border-border flex items-center gap-2 border-t pt-2 text-xs">
              <span className="text-muted-foreground flex-1">
                {draft.from && !draft.to
                  ? 'روز پایان را انتخاب کنید'
                  : (dateRangeLabel(draft) ?? 'روز شروع را انتخاب کنید')}
              </span>
              {draft.from && !draft.to ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => apply({ from: draft.from, to: draft.from })}
                >
                  فقط همین روز
                </Button>
              ) : null}
              {text ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => apply({})}>
                  <X /> پاک کردن
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
