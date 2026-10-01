'use client';

import type { AiDraft, TicketMessageView } from '@toolshop/shared';
import { Button, Checkbox, cn, Label, Spinner, Textarea } from '@toolshop/ui';
import { Lock, Send } from 'lucide-react';
import { useState } from 'react';
import { AiButton, AiDraftNote } from '@/components/admin/ai-assist';
import { errorMessage } from '@/lib/api/errors';
import { dateTime } from '@/lib/format';

/**
 * Conversation view shared by the customer account and the admin panel. `perspective`
 * decides which side is "ours" (right in RTL) so each party reads its own messages
 * on the same side, like a messenger.
 */
export function TicketThread({
  messages,
  perspective,
}: {
  messages: TicketMessageView[];
  perspective: 'customer' | 'staff';
}) {
  return (
    <ol className="space-y-4" aria-label="پیام‌ها">
      {messages.map((message) => {
        if (message.authorType === 'system') {
          return (
            <li key={message.id} className="text-muted-foreground text-center text-xs">
              <span className="bg-muted rounded-full px-3 py-1">
                {message.body} · {dateTime(message.createdAt)}
              </span>
            </li>
          );
        }
        const ours = message.authorType === perspective;
        return (
          <li key={message.id} className={cn('flex', ours ? 'justify-start' : 'justify-end')}>
            <div
              className={cn(
                'max-w-[85%] rounded-lg border px-4 py-3 sm:max-w-[75%]',
                message.isInternal
                  ? 'border-warning/40 bg-warning-soft'
                  : ours
                    ? 'border-primary/20 bg-primary/5'
                    : 'border-border bg-card',
              )}
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-bold">{message.authorName}</span>
                {message.isInternal ? (
                  <span className="text-warning inline-flex items-center gap-1 font-semibold">
                    <Lock className="size-3" /> یادداشت داخلی
                  </span>
                ) : null}
                <span className="text-muted-foreground">{dateTime(message.createdAt)}</span>
              </div>
              <p className="whitespace-pre-line text-sm leading-7">{message.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface ReplyValues {
  body: string;
  internal: boolean;
  close: boolean;
}

/**
 * Reply box; staff additionally get "internal note", "reply and close" and – with
 * `onAiDraft` – an AI-drafted reply that fills the box for review (never auto-sent).
 */
export function TicketReplyForm({
  onSubmit,
  pending,
  staff,
  canClose = false,
  onAiDraft,
}: {
  onSubmit: (values: ReplyValues) => Promise<unknown>;
  pending: boolean;
  staff?: boolean;
  canClose?: boolean;
  onAiDraft?: () => Promise<AiDraft>;
}) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [close, setClose] = useState(false);
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const tooShort = body.trim().length < 2;

  const requestDraft = async () => {
    if (!onAiDraft) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const result = await onAiDraft();
      setDraft(result);
      setBody(result.text);
      setInternal(false);
    } catch (error) {
      setDraftError(errorMessage(error));
    } finally {
      setDrafting(false);
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (tooShort) return;
        void onSubmit({ body: body.trim(), internal, close }).then(() => {
          setBody('');
          setInternal(false);
          setClose(false);
          setDraft(null);
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="ticket-reply">{internal ? 'یادداشت داخلی' : 'پاسخ شما'}</Label>
        {onAiDraft ? (
          <AiButton pending={drafting} onClick={() => void requestDraft()}>
            پیش‌نویس با هوش مصنوعی
          </AiButton>
        ) : null}
      </div>
      {draftError ? <p className="text-destructive text-xs">{draftError}</p> : null}
      {draft ? <AiDraftNote confidence={draft.confidence} notes={draft.notes} /> : null}
      <Textarea
        id="ticket-reply"
        rows={4}
        maxLength={5000}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={
          internal ? 'فقط همکاران پشتیبانی این یادداشت را می‌بینند…' : 'پیام خود را بنویسید…'
        }
        className={cn(internal && 'border-warning/50 bg-warning-soft/40')}
      />
      <div className="flex flex-wrap items-center gap-4">
        {staff ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={internal} onCheckedChange={(v) => setInternal(v === true)} />
            یادداشت داخلی (برای مشتری نمایش داده نمی‌شود)
          </label>
        ) : null}
        {staff && canClose ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={close} onCheckedChange={(v) => setClose(v === true)} />
            بستن تیکت پس از ارسال
          </label>
        ) : null}
        <Button type="submit" className="ms-auto" disabled={pending || tooShort}>
          {pending ? <Spinner /> : <Send />}
          {internal ? 'ثبت یادداشت' : 'ارسال پاسخ'}
        </Button>
      </div>
    </form>
  );
}
