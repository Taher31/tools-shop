'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  DataEntityKey,
  DataEntityView,
  ImportReport,
  ImportRowStatus,
} from '@toolshop/shared';
import {
  Alert,
  Badge,
  type BadgeProps,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Skeleton,
  Spinner,
  toast,
} from '@toolshop/ui';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { PageHeader } from '@/components/admin/page-header';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { faNumber } from '@/lib/format';

const STATUS: Record<ImportRowStatus, { label: string; variant: BadgeProps['variant'] }> = {
  create: { label: 'جدید', variant: 'success' },
  update: { label: 'به‌روزرسانی', variant: 'info' },
  unchanged: { label: 'بدون تغییر', variant: 'secondary' },
  error: { label: 'خطا', variant: 'destructive' },
};

const download = (path: string) => {
  // An attachment link keeps the session cookie and lets the browser save the file.
  const link = document.createElement('a');
  link.href = `/api/v1${path}`;
  link.download = '';
  document.body.append(link);
  link.click();
  link.remove();
};

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn('text-2xl font-black', tone)}>{faNumber(value)}</p>
    </div>
  );
}

function ReportView({ report }: { report: ImportReport }) {
  const [onlyErrors, setOnlyErrors] = useState(report.failed > 0);
  const shown = onlyErrors ? report.results.filter((r) => r.status === 'error') : report.results;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="ردیف‌های فایل" value={report.totalRows} />
        <Stat label="جدید" value={report.created} tone="text-success" />
        <Stat label="به‌روزرسانی" value={report.updated} tone="text-info" />
        <Stat label="بدون تغییر" value={report.unchanged} />
        <Stat label="خطا" value={report.failed} tone={report.failed ? 'text-destructive' : ''} />
      </div>
      {report.unknownColumns.length > 0 ? (
        <Alert variant="warning">
          ستون‌های ناشناس نادیده گرفته شدند: {report.unknownColumns.join('، ')}
        </Alert>
      ) : null}
      {report.results.some((r) => r.status === 'error') ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyErrors}
            onChange={(e) => setOnlyErrors(e.target.checked)}
          />
          فقط ردیف‌های دارای خطا
        </label>
      ) : null}
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs">
            <tr>
              <th className="px-3 py-2 text-start">ردیف</th>
              <th className="px-3 py-2 text-start">مورد</th>
              <th className="px-3 py-2 text-start">نتیجه</th>
              <th className="px-3 py-2 text-start">توضیح</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {shown.map((result) => (
              <tr key={result.row}>
                <td className="whitespace-nowrap px-3 py-2">{faNumber(result.row)}</td>
                <td className="max-w-56 truncate px-3 py-2">{result.label}</td>
                <td className="px-3 py-2">
                  <Badge variant={STATUS[result.status].variant}>
                    {STATUS[result.status].label}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs leading-6">
                  {result.messages.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {result.messages.map((m, i) => (
                        <li key={i} className={result.status === 'error' ? 'text-destructive' : ''}>
                          {m}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-3 py-6 text-center">
                  موردی برای نمایش نیست
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {report.truncated ? (
        <p className="text-muted-foreground text-xs">
          فقط بخشی از ردیف‌های موفق نمایش داده شده است؛ همه خطاها نمایش داده می‌شوند.
        </p>
      ) : null}
    </div>
  );
}

function ImportPanel({ entity }: { entity: DataEntityView }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const run = useMutation({
    mutationFn: async (dryRun: boolean) => {
      if (!file) throw new Error('no file');
      const form = new FormData();
      form.append('file', file);
      return api.upload<ImportReport>(`/admin/data/${entity.key}/import?dryRun=${dryRun}`, form);
    },
    onSuccess: (result) => {
      setReport(result);
      if (!result.dryRun)
        toast.success(`ورود انجام شد: ${result.created} جدید، ${result.updated} به‌روزرسانی`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const pick = (next: File | null) => {
    setFile(next);
    setReport(null);
    run.reset();
  };
  const ready = report?.dryRun && report.failed === 0 && report.created + report.updated > 0;
  const partial = report?.dryRun && report.failed > 0 && report.created + report.updated > 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>۱. فایل نمونه</CardTitle>
          <p className="text-muted-foreground text-xs leading-6">
            نمونه شامل ردیف‌های مثال و برگه «راهنما» برای توضیح هر ستون است. ستون‌های نارنجی
            الزامی‌اند.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => download(`/admin/data/${entity.key}/template?format=xlsx`)}
          >
            <FileSpreadsheet /> دانلود نمونه Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => download(`/admin/data/${entity.key}/template?format=csv`)}
          >
            <FileText /> دانلود نمونه CSV
          </Button>
          {entity.canExport ? (
            <Button
              variant="ghost"
              onClick={() => download(`/admin/data/${entity.key}/export?format=xlsx`)}
            >
              <Download /> خروجی داده‌های فعلی (برای ویرایش و بارگذاری مجدد)
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>۲. ستون‌ها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr>
                  <th className="px-3 py-2 text-start">ستون</th>
                  <th className="px-3 py-2 text-start">توضیح</th>
                  <th className="px-3 py-2 text-start">نمونه</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {entity.columns.map((c) => (
                  <tr key={c.header}>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold">
                      {c.header}
                      {c.required ? <span className="text-destructive"> *</span> : null}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs leading-6">
                      {c.description}
                    </td>
                    <td className="ltr px-3 py-2 text-xs">{c.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {entity.dynamicColumns ? <Alert variant="info">{entity.dynamicColumns}</Alert> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>۳. بارگذاری فایل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files[0] ?? null);
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
            )}
          >
            {file ? (
              <FileUp className="text-primary size-8" />
            ) : (
              <UploadCloud className="text-muted-foreground size-8" />
            )}
            <p className="text-sm font-semibold">
              {file ? file.name : 'فایل xlsx یا csv را اینجا رها کنید یا کلیک کنید'}
            </p>
            <p className="text-muted-foreground text-xs">
              {file
                ? `${faNumber(Math.ceil(file.size / 1024))} کیلوبایت`
                : 'حداکثر ۸ مگابایت و ۵٬۰۰۰ ردیف'}
            </p>
            <input
              ref={input}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              aria-label="انتخاب فایل"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={!file || run.isPending}
              onClick={() => run.mutate(true)}
            >
              {run.isPending && run.variables === true ? <Spinner /> : <ShieldCheck />}
              بررسی بدون ذخیره
            </Button>
            <Button
              disabled={
                !file || run.isPending || !report?.dryRun || report.created + report.updated === 0
              }
              onClick={() => run.mutate(false)}
            >
              {run.isPending && run.variables === false ? <Spinner /> : <CheckCircle2 />}
              {partial ? 'ثبت ردیف‌های سالم' : 'ثبت نهایی'}
            </Button>
            {file ? (
              <Button variant="ghost" onClick={() => pick(null)}>
                <RotateCcw /> انتخاب فایل دیگر
              </Button>
            ) : null}
          </div>
          {report?.dryRun ? (
            <Alert variant={ready ? 'success' : partial ? 'warning' : 'destructive'}>
              {ready
                ? 'بررسی بدون خطا انجام شد. برای اعمال تغییرات «ثبت نهایی» را بزنید.'
                : partial
                  ? 'برخی ردیف‌ها خطا دارند. با «ثبت ردیف‌های سالم» فقط ردیف‌های بدون خطا ثبت می‌شوند؛ یا فایل را اصلاح و دوباره بررسی کنید.'
                  : 'هیچ ردیف قابل ثبتی پیدا نشد؛ خطاها را اصلاح کنید.'}
            </Alert>
          ) : report ? (
            <Alert variant="success">
              ورود انجام شد و در گزارش رویدادها ثبت گردید.
              {report.failed > 0 ? ` ${faNumber(report.failed)} ردیف به‌دلیل خطا ثبت نشد.` : ''}
            </Alert>
          ) : null}
          {report ? <ReportView report={report} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DataCenterPage() {
  const entities = useQuery({
    queryKey: ['admin', 'data', 'entities'],
    queryFn: () => api.get<DataEntityView[]>('/admin/data/entities'),
  });
  const [selected, setSelected] = useState<DataEntityKey>('products');
  const list = entities.data ?? [];
  const current = list.find((e) => e.key === selected) ?? list[0];

  return (
    <>
      <PageHeader
        title="ورود و خروج داده"
        description="افزودن و ویرایش گروهی محصولات، دسته‌بندی‌ها، برندها، کدهای تخفیف و موجودی از فایل Excel یا CSV، و گرفتن خروجی. هر ورود ابتدا بدون ذخیره بررسی می‌شود."
      />
      {!entities.data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav
            aria-label="بخش‌ها"
            className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible"
          >
            {list.map((entity) => (
              <button
                key={entity.key}
                type="button"
                onClick={() => setSelected(entity.key)}
                aria-current={current?.key === entity.key}
                className={cn(
                  'border-border flex shrink-0 flex-col items-start rounded-lg border px-4 py-3 text-start transition-colors lg:w-full',
                  current?.key === entity.key
                    ? 'bg-primary/5 border-primary/40'
                    : 'hover:bg-muted/50',
                )}
              >
                <span className="text-sm font-bold">{entity.label}</span>
                <span className="text-muted-foreground mt-0.5 flex gap-1 text-[11px]">
                  {entity.canImport ? <Badge variant="secondary">ورود</Badge> : null}
                  {entity.canExport ? <Badge variant="secondary">خروج</Badge> : null}
                </span>
              </button>
            ))}
          </nav>
          {current ? (
            <div className="min-w-0 space-y-4">
              <p className="text-muted-foreground text-sm leading-7">{current.description}</p>
              {current.canImport ? (
                <ImportPanel key={current.key} entity={current} />
              ) : (
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-3 pt-5">
                    <p className="text-sm">
                      {current.canExport
                        ? 'این بخش فقط خروجی دارد. برای خروجی فیلترشده از دکمه «خروجی» در خود فهرست استفاده کنید.'
                        : 'دسترسی ورود برای این بخش ندارید.'}
                    </p>
                    {current.canExport ? (
                      <>
                        <Button
                          onClick={() => download(`/admin/data/${current.key}/export?format=xlsx`)}
                        >
                          <FileSpreadsheet /> خروجی Excel
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => download(`/admin/data/${current.key}/export?format=csv`)}
                        >
                          <FileText /> خروجی CSV
                        </Button>
                      </>
                    ) : null}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
