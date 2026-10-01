'use client';

import { useQuery } from '@tanstack/react-query';
import type { AssistantProduct, AssistantPublicConfig } from '@toolshop/shared';
import { Button, cn, Spinner } from '@toolshop/ui';
import { MessageCircle, RotateCcw, Send, ShoppingCart, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ProductImage } from '@/components/product/product-image';
import { useAssistant } from '@/hooks/use-assistant';
import { useAddToCart } from '@/hooks/use-cart';
import { api } from '@/lib/api/client';
import { price } from '@/lib/format';

function ProductChip({ product }: { product: AssistantProduct }) {
  const add = useAddToCart();
  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-md border p-2">
      <Link
        href={`/product/${product.slug}`}
        className="bg-muted relative size-14 shrink-0 overflow-hidden rounded"
      >
        <ProductImage src={product.imageUrl} alt={product.title} sizes="56px" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/product/${product.slug}`}
          className="line-clamp-2 text-xs font-semibold hover:underline"
        >
          {product.title}
        </Link>
        <p className="mt-0.5 text-xs">
          {product.inStock ? (
            <span className="font-bold">{price(product.price)}</span>
          ) : (
            <span className="text-muted-foreground">ناموجود</span>
          )}
        </p>
      </div>
      {product.inStock && product.defaultVariantId ? (
        <Button
          size="icon"
          variant="outline"
          className="size-8 shrink-0"
          aria-label={`افزودن ${product.title} به سبد`}
          disabled={add.isPending}
          onClick={() => add.mutate({ variantId: product.defaultVariantId as string, quantity: 1 })}
        >
          <ShoppingCart className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

/** Floating AI shopping assistant (rendered only when enabled in the AI Center). */
export function AssistantWidget() {
  const config = useQuery({
    queryKey: ['assistant-config'],
    queryFn: () => api.get<AssistantPublicConfig>('/ai/assistant/config'),
    staleTime: 300_000,
    retry: false,
  });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const { messages, busy, send, reset } = useAssistant(open);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  if (!config.data?.enabled) return null;
  const { name, greeting, suggestions } = config.data;
  const submit = (text: string) => {
    if (!text.trim()) return;
    setDraft('');
    void send(text);
  };

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-primary text-primary-foreground fixed bottom-5 end-5 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold shadow-lg transition hover:scale-[1.03] print:hidden"
          aria-label={`گفت‌وگو با ${name}`}
        >
          <Sparkles className="text-accent size-5" />
          <span className="hidden sm:inline">{name}</span>
          <MessageCircle className="size-5 sm:hidden" />
        </button>
      ) : null}

      {open ? (
        <section
          role="dialog"
          aria-label={name}
          className="border-border bg-background fixed inset-0 z-50 flex flex-col shadow-2xl sm:inset-auto sm:bottom-5 sm:end-5 sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[400px] sm:rounded-xl sm:border print:hidden"
        >
          <header className="bg-primary text-primary-foreground flex items-center gap-2 px-4 py-3 sm:rounded-t-xl">
            <Sparkles className="text-accent size-5" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{name}</p>
              <p className="text-primary-foreground/70 text-[11px]">
                هوش مصنوعی · قیمت و موجودی لحظه‌ای
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="hover:bg-primary-foreground/10 size-8 text-inherit"
              onClick={reset}
              aria-label="گفت‌وگوی جدید"
              title="گفت‌وگوی جدید"
            >
              <RotateCcw className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="hover:bg-primary-foreground/10 size-8 text-inherit"
              onClick={() => setOpen(false)}
              aria-label="بستن"
            >
              <X className="size-5" />
            </Button>
          </header>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            <div className="bg-muted max-w-[85%] rounded-lg rounded-ss-none px-3 py-2 text-sm leading-7">
              {greeting}
            </div>
            {messages.length === 0 ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => submit(suggestion)}
                    className="border-border hover:bg-muted rounded-full border px-3 py-1.5 text-xs"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex flex-col gap-2',
                  message.role === 'user' ? 'items-end' : 'items-start',
                )}
              >
                {message.text || message.status ? (
                  <div
                    className={cn(
                      'max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm leading-7',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-se-none'
                        : message.error
                          ? 'bg-destructive-soft text-destructive rounded-ss-none'
                          : 'bg-muted rounded-ss-none',
                    )}
                  >
                    {message.text}
                    {message.status ? (
                      <span className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Spinner className="size-3" /> {message.status}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {message.products.length > 0 ? (
                  <div className="w-full max-w-[90%] space-y-2">
                    {message.products.map((product) => (
                      <ProductChip key={product.id} product={product} />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <form
            className="border-border flex items-end gap-2 border-t p-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit(draft);
            }}
          >
            <textarea
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              rows={1}
              maxLength={1000}
              placeholder="سؤالتان را بنویسید…"
              aria-label="پیام"
              className="border-input bg-background focus-visible:ring-ring max-h-32 min-h-10 flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
            <Button type="submit" size="icon" disabled={busy || !draft.trim()} aria-label="ارسال">
              {busy ? <Spinner /> : <Send className="size-4 rtl:-scale-x-100" />}
            </Button>
          </form>
          <p className="text-muted-foreground px-3 pb-2 text-center text-[10px]">
            ممکن است پاسخ‌ها خطا داشته باشند؛ برای موارد مهم با{' '}
            <Link href="/account/tickets/new" className="underline">
              پشتیبانی
            </Link>{' '}
            در تماس باشید.
          </p>
        </section>
      ) : null}
    </>
  );
}
