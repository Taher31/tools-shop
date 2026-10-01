'use client';

import { Button } from '@toolshop/ui';
import { useMemo, useState } from 'react';
import { date, faNumber, price } from '@/lib/format';

interface Point {
  date: string;
  total: number;
  orders: number;
}

const HEIGHT = 220;
const PAD = { top: 24, bottom: 28, start: 84, end: 8 };

function niceStep(max: number): number {
  const raw = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10;
  return step;
}

const compact = (rial: number) => {
  const toman = rial / 10;
  if (toman >= 1_000_000) return `${faNumber(Math.round((toman / 1_000_000) * 10) / 10)} میلیون`;
  if (toman >= 1_000) return `${faNumber(Math.round(toman / 1_000))} هزار`;
  return faNumber(toman);
};

/**
 * Single-series column chart (daily revenue). RTL: time runs right → left like the
 * text. Hover/focus a column for its exact values; a table view is one click away.
 */
export function SalesChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const width = 720;
  const { step, top } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.total), 0);
    const s = niceStep(max || 10_000_000);
    return { step: s, top: Math.max(s * 4, Math.ceil(max / s) * s) };
  }, [data]);
  const plotWidth = width - PAD.start - PAD.end;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const band = plotWidth / Math.max(1, data.length);
  const barWidth = Math.min(24, band * 0.6);
  const maxIndex = data.reduce((best, d, i) => (d.total > (data[best]?.total ?? 0) ? i : best), 0);
  const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;
  // index 0 (oldest) sits at the right edge
  const xCenter = (index: number) => PAD.start + plotWidth - band * index - band / 2;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setAsTable(!asTable)}>
          {asTable ? 'نمایش نمودار' : 'نمایش جدول'}
        </Button>
      </div>
      {asTable ? (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-2 text-start font-medium">تاریخ</th>
              <th className="py-2 text-start font-medium">سفارش</th>
              <th className="py-2 text-start font-medium">فروش</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t border-border">
                <td className="py-1.5">{date(d.date)}</td>
                <td className="py-1.5">{faNumber(d.orders)}</td>
                <td className="py-1.5">{price(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="نمودار فروش روزانه ۱۴ روز اخیر">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.start} x2={width - PAD.end} y1={y(tick)} y2={y(tick)} stroke="var(--chart-grid)" strokeWidth={1} />
                <text x={PAD.start - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[11px]">
                  {compact(tick)}
                </text>
              </g>
            ))}
            {data.map((d, index) => {
              const cx = xCenter(index);
              const barTop = y(d.total);
              const h = Math.max(0, PAD.top + plotHeight - barTop);
              const r = Math.min(4, h);
              const x0 = cx - barWidth / 2;
              const x1 = cx + barWidth / 2;
              const base = PAD.top + plotHeight;
              const path = h > 0
                ? `M${x0},${base} V${barTop + r} Q${x0},${barTop} ${x0 + r},${barTop} H${x1 - r} Q${x1},${barTop} ${x1},${barTop + r} V${base} Z`
                : '';
              const showLabel = index === maxIndex && d.total > 0;
              return (
                <g key={d.date}>
                  {path ? <path d={path} fill="var(--chart-1)" opacity={hover === null || hover === index ? 1 : 0.55} /> : null}
                  {showLabel ? (
                    <text x={cx} y={barTop - 6} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
                      {compact(d.total)}
                    </text>
                  ) : null}
                  {index % 2 === 0 || data.length <= 7 ? (
                    <text x={cx} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                      {new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'short', timeZone: 'Asia/Tehran' }).format(new Date(d.date))}
                    </text>
                  ) : null}
                  <rect
                    x={cx - band / 2}
                    y={PAD.top}
                    width={band}
                    height={plotHeight}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${date(d.date)}: ${price(d.total)}، ${faNumber(d.orders)} سفارش`}
                    onMouseEnter={() => setHover(index)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(index)}
                    onBlur={() => setHover(null)}
                    className="outline-none"
                  />
                </g>
              );
            })}
            <line x1={PAD.start} x2={width - PAD.end} y1={PAD.top + plotHeight} y2={PAD.top + plotHeight} stroke="var(--border)" strokeWidth={1} />
          </svg>
          {hover !== null && data[hover] ? (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg"
              style={{ left: `${(xCenter(hover) / width) * 100}%` }}
            >
              <p className="font-bold">{date(data[hover].date)}</p>
              <p className="text-muted-foreground">
                فروش: <span className="font-semibold text-foreground">{price(data[hover].total)}</span>
              </p>
              <p className="text-muted-foreground">
                سفارش: <span className="font-semibold text-foreground">{faNumber(data[hover].orders)}</span>
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
