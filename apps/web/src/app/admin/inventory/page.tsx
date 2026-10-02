'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type InventoryRow,
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_TYPES,
  type StockMovementView,
  type WarehouseView,
} from '@toolshop/shared';
import {
  Badge,
  Button,
  Field,
  Input,
  NativeSelect,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@toolshop/ui';
import { ArrowLeftRight, PackagePlus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { DataTable, Pager, SearchInput, TableCard } from '@/components/admin/data-table';
import { FormDialog } from '@/components/admin/form-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminList, useAdminMutation } from '@/components/admin/query';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { dateTime, faNumber } from '@/lib/format';
import { FilterBar } from '@/components/admin/filter-bar';

type OperationType = 'purchase' | 'return' | 'adjustment' | 'set';
const OPERATION_LABELS: Record<OperationType, string> = {
  purchase: 'ورود کالا (خرید)',
  return: 'مرجوعی مشتری',
  adjustment: 'اصلاح (+/−)',
  set: 'تنظیم موجودی شمارش‌شده',
};

function OperationDialog({
  row,
  warehouses,
  onClose,
}: {
  row: InventoryRow;
  warehouses: WarehouseView[];
  onClose: () => void;
}) {
  const [type, setType] = useState<OperationType>('purchase');
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? '',
  );
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const save = useAdminMutation(
    () =>
      api.post('/admin/inventory/operations', {
        variantId: row.variantId,
        warehouseId,
        type,
        quantity: Number(quantity),
        reference: reference || null,
        note: note || null,
      }),
    { success: 'موجودی به‌روزرسانی شد.', onSuccess: onClose },
  );
  const current = row.levels.find((l) => l.warehouseId === warehouseId);
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`عملیات انبار – ${row.sku}`}
      loading={save.isPending}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined);
      }}
    >
      <p className="text-muted-foreground text-sm">
        {row.productTitle}
        {row.variantTitle ? ` – ${row.variantTitle}` : ''}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نوع عملیات" htmlFor="op-type">
          <NativeSelect
            id="op-type"
            value={type}
            onChange={(e) => setType(e.target.value as OperationType)}
          >
            {Object.entries(OPERATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="انبار" htmlFor="op-wh">
          <NativeSelect
            id="op-wh"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            {warehouses
              .filter((w) => w.isActive)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field
          label={
            type === 'set'
              ? 'موجودی شمارش‌شده'
              : type === 'adjustment'
                ? 'مقدار اصلاح (منفی برای کاهش)'
                : 'تعداد'
          }
          htmlFor="op-qty"
          required
          hint={
            current
              ? `موجودی فعلی: ${faNumber(current.onHand)} (رزرو ${faNumber(current.reserved)})`
              : 'هنوز موجودی در این انبار ثبت نشده'
          }
        >
          <Input
            id="op-qty"
            type="number"
            dir="ltr"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label="شماره سند / فاکتور خرید" htmlFor="op-ref">
          <Input id="op-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="توضیحات" htmlFor="op-note" className="sm:col-span-2">
          <Textarea id="op-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}

function TransferDialog({
  row,
  warehouses,
  onClose,
}: {
  row: InventoryRow;
  warehouses: WarehouseView[];
  onClose: () => void;
}) {
  const active = warehouses.filter((w) => w.isActive);
  const [from, setFrom] = useState(
    row.levels.find((l) => l.available > 0)?.warehouseId ?? active[0]?.id ?? '',
  );
  const [to, setTo] = useState(active.find((w) => w.id !== from)?.id ?? '');
  const [quantity, setQuantity] = useState('');
  const save = useAdminMutation(
    () =>
      api.post('/admin/inventory/transfers', {
        variantId: row.variantId,
        fromWarehouseId: from,
        toWarehouseId: to,
        quantity: Number(quantity),
        note: null,
      }),
    { success: 'انتقال ثبت شد.', onSuccess: onClose },
  );
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`انتقال بین انبارها – ${row.sku}`}
      loading={save.isPending}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="از انبار" htmlFor="tr-from">
          <NativeSelect id="tr-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {active.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({faNumber(row.levels.find((l) => l.warehouseId === w.id)?.available ?? 0)}
                )
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="به انبار" htmlFor="tr-to">
          <NativeSelect id="tr-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {active
              .filter((w) => w.id !== from)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field label="تعداد" htmlFor="tr-qty" required>
          <Input
            id="tr-qty"
            type="number"
            min={1}
            dir="ltr"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
      </div>
    </FormDialog>
  );
}

function StockTab() {
  const { can } = usePermissions();
  const params = useSearchParams();
  const list = useAdminList<InventoryRow>('/admin/inventory', {
    q: params.get('q') ?? undefined,
    lowStock: params.get('lowStock') ?? undefined,
  });
  const warehouses = useQuery({
    queryKey: ['admin', 'warehouses'],
    queryFn: () => api.get<WarehouseView[]>('/admin/warehouses'),
  });
  const [operation, setOperation] = useState<InventoryRow | null>(null);
  const [transfer, setTransfer] = useState<InventoryRow | null>(null);

  return (
    <TableCard
      toolbar={
        <>
          <SearchInput
            onSearch={list.setSearch}
            placeholder="SKU، بارکد یا نام کالا"
            className="w-64"
          />
          <NativeSelect
            className="h-9 w-48"
            value={(list.params.warehouseId as string) ?? ''}
            onChange={(e) => list.update({ warehouseId: e.target.value || undefined })}
            aria-label="انبار"
          >
            <option value="">همه انبارها</option>
            {warehouses.data?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </NativeSelect>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={list.params.lowStock === 'true'}
              onCheckedChange={(v) => list.update({ lowStock: v ? 'true' : undefined })}
            />{' '}
            فقط کم‌موجود
          </label>
        </>
      }
    >
      <DataTable
        rows={list.data?.items}
        loading={list.isLoading}
        rowKey={(r) => r.variantId}
        columns={[
          {
            header: 'کالا',
            cell: (r) => (
              <div className="max-w-xs">
                <p className="line-clamp-1 font-semibold">{r.productTitle}</p>
                {r.variantTitle ? (
                  <p className="text-muted-foreground text-xs">{r.variantTitle}</p>
                ) : null}
              </div>
            ),
          },
          { header: 'SKU', cell: (r) => <span className="ltr font-mono text-xs">{r.sku}</span> },
          {
            header: 'موجودی انبارها',
            cell: (r) => (
              <div className="flex flex-wrap gap-1">
                {r.levels.map((l) => (
                  <Badge key={l.warehouseId} variant="outline" className="font-normal">
                    {l.warehouseCode}: {faNumber(l.onHand)}
                  </Badge>
                ))}
              </div>
            ),
          },
          { header: 'کل', cell: (r) => faNumber(r.onHand) },
          {
            header: 'رزرو',
            cell: (r) =>
              r.reserved > 0 ? <Badge variant="warning">{faNumber(r.reserved)}</Badge> : '۰',
          },
          {
            header: 'قابل فروش',
            cell: (r) => (
              <Badge
                variant={r.available === 0 ? 'destructive' : r.isLowStock ? 'warning' : 'success'}
              >
                {faNumber(r.available)}
              </Badge>
            ),
          },
          {
            header: '',
            cell: (r) =>
              can('inventory.update') ? (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => setOperation(r)}>
                    <PackagePlus /> عملیات
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setTransfer(r)}
                    aria-label="انتقال"
                  >
                    <ArrowLeftRight />
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />
      <Pager data={list.data} onPage={list.setPage} />
      {operation && warehouses.data ? (
        <OperationDialog
          row={operation}
          warehouses={warehouses.data}
          onClose={() => setOperation(null)}
        />
      ) : null}
      {transfer && warehouses.data ? (
        <TransferDialog
          row={transfer}
          warehouses={warehouses.data}
          onClose={() => setTransfer(null)}
        />
      ) : null}
    </TableCard>
  );
}

function MovementsTab() {
  const list = useAdminList<StockMovementView>('/admin/inventory/movements');
  return (
    <TableCard
      toolbar={
        <FilterBar
          list={list}
          searchPlaceholder="SKU یا شماره سند"
          dateLabel="تاریخ"
          inline={[
            {
              type: 'select',
              key: 'type',
              label: 'نوع حرکت',
              options: STOCK_MOVEMENT_TYPES.map((t) => ({
                value: t,
                label: STOCK_MOVEMENT_LABELS[t],
              })),
            },
          ]}
        />
      }
    >
      <DataTable
        rows={list.data?.items}
        loading={list.isLoading}
        rowKey={(m) => m.id}
        columns={[
          { header: 'زمان', cell: (m) => <span className="text-xs">{dateTime(m.createdAt)}</span> },
          { header: 'نوع', cell: (m) => STOCK_MOVEMENT_LABELS[m.type] },
          {
            header: 'کالا',
            cell: (m) => (
              <div>
                <p className="line-clamp-1 text-xs">{m.productTitle}</p>
                <p className="ltr text-muted-foreground text-end font-mono text-[11px]">{m.sku}</p>
              </div>
            ),
          },
          { header: 'انبار', cell: (m) => m.warehouseName },
          {
            header: 'تغییر',
            cell: (m) => (
              <span
                className={m.quantity > 0 ? 'text-success font-bold' : 'text-destructive font-bold'}
                dir="ltr"
              >
                {m.quantity > 0 ? '+' : ''}
                {faNumber(m.quantity)}
              </span>
            ),
          },
          { header: 'موجودی بعد', cell: (m) => faNumber(m.onHandAfter) },
          {
            header: 'سند',
            cell: (m) => <span className="ltr font-mono text-xs">{m.reference ?? '—'}</span>,
          },
          {
            header: 'کاربر',
            cell: (m) => <span className="text-xs">{m.actorName ?? 'سیستم'}</span>,
          },
        ]}
      />
      <Pager data={list.data} onPage={list.setPage} />
    </TableCard>
  );
}

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="موجودی انبار"
        description="موجودی = فیزیکی − رزرو سفارش‌های در انتظار پرداخت. همه تغییرات در دفتر حرکات ثبت می‌شوند."
      />
      <Tabs defaultValue="stock" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="stock">موجودی کالاها</TabsTrigger>
          <TabsTrigger value="movements">دفتر حرکات انبار</TabsTrigger>
        </TabsList>
        <TabsContent value="stock" className="pt-0">
          <Suspense>
            <StockTab />
          </Suspense>
        </TabsContent>
        <TabsContent value="movements" className="pt-0">
          <MovementsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
