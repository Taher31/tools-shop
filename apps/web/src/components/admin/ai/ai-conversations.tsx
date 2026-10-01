'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type AiConversationDetail,
  type AiConversationSummary,
  MESSENGER_LABELS,
} from '@toolshop/shared';
import {
  Badge,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  NativeSelect,
  Skeleton,
} from '@toolshop/ui';
import { Wrench } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DataTable, Pager, TableCard } from '@/components/admin/data-table';
import { useAdminList } from '@/components/admin/query';
import { api } from '@/lib/api/client';
import { dateTime, faNumber, price } from '@/lib/format';

const CHANNEL_LABELS: Record<string, string> = { web: 'وب‌سایت', ...MESSENGER_LABELS };

function ConversationDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['admin', 'ai', 'conversation', id],
    queryFn: () => api.get<AiConversationDetail>(`/admin/ai/conversations/${id}`),
  });
  const c = detail.data;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{c?.title ?? 'گفت‌وگو'}</DialogTitle>
          {c ? (
            <p className="text-muted-foreground text-xs">
              {CHANNEL_LABELS[c.channel] ?? c.channel} ·{' '}
              {c.customer?.fullName ?? 'بازدیدکننده ناشناس'} · {dateTime(c.createdAt)}
            </p>
          ) : null}
        </DialogHeader>
        {!c ? (
          <Skeleton className="h-60" />
        ) : (
          <ol className="max-h-[65vh] space-y-3 overflow-y-auto pe-1">
            {c.messages.map((m) => (
              <li
                key={m.id}
                className={cn('flex', m.role === 'user' ? 'justify-start' : 'justify-end')}
              >
                <div
                  className={cn(
                    'max-w-[85%] space-y-2 rounded-lg border px-3 py-2 text-sm leading-7',
                    m.role === 'user'
                      ? 'bg-card'
                      : 'border-violet-200 bg-violet-50/60 dark:border-violet-500/30 dark:bg-violet-500/10',
                  )}
                >
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.tools.length > 0 ? (
                    <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
                      <Wrench className="size-3" />
                      {m.tools.map((t, i) => (
                        <code key={i} className="bg-muted ltr rounded px-1">
                          {t.name}
                        </code>
                      ))}
                    </p>
                  ) : null}
                  {m.products.length > 0 ? (
                    <ul className="flex flex-wrap gap-1">
                      {m.products.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/product/${p.slug}`}
                            target="_blank"
                            className="text-info bg-background rounded border px-2 py-0.5 text-xs hover:underline"
                          >
                            {p.title} · {price(p.price)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-muted-foreground text-[11px]">{dateTime(m.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AiConversations() {
  const list = useAdminList<AiConversationSummary>('/admin/ai/conversations');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <TableCard
        toolbar={
          <NativeSelect
            className="h-9 w-44"
            value={(list.params.channel as string) ?? ''}
            onChange={(e) => list.update({ channel: e.target.value || undefined })}
            aria-label="کانال"
          >
            <option value="">همه کانال‌ها</option>
            {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        }
      >
        <DataTable
          rows={list.data?.items}
          loading={list.isLoading}
          rowKey={(c) => c.id}
          onRowClick={(c) => setOpen(c.id)}
          empty="هنوز گفت‌وگویی ثبت نشده است"
          columns={[
            {
              header: 'موضوع',
              cell: (c) => <span className="line-clamp-1 max-w-72 text-sm">{c.title ?? '—'}</span>,
            },
            {
              header: 'کانال',
              cell: (c) => (
                <Badge variant="secondary">{CHANNEL_LABELS[c.channel] ?? c.channel}</Badge>
              ),
            },
            {
              header: 'مشتری',
              cell: (c) => <span className="text-xs">{c.customer?.fullName ?? 'ناشناس'}</span>,
            },
            {
              header: 'پیام',
              cell: (c) => <span className="text-xs">{faNumber(c.messageCount)}</span>,
            },
            {
              header: 'آخرین فعالیت',
              cell: (c) => <span className="text-xs">{dateTime(c.lastMessageAt)}</span>,
            },
          ]}
        />
        <Pager data={list.data} onPage={list.setPage} />
      </TableCard>
      {open ? <ConversationDialog id={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
