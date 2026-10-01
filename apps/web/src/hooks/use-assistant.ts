'use client';

import type {
  AssistantConversationView,
  AssistantProduct,
  AssistantStreamEvent,
} from '@toolshop/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import { errorMessage, toApiError } from '@/lib/api/errors';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  products: AssistantProduct[];
  /** Tool currently running ("searching products…"), while streaming. */
  status?: string | null;
  error?: boolean;
}

const STORAGE_KEY = 'ts_ai_conversation';

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string | null): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): the conversation just won't survive a reload.
  }
}

/** Parses `event:/data:` blocks from a text/event-stream body. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AssistantStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf('\n\n');
    while (separator !== -1) {
      const chunk = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const data = chunk.split('\n').find((line) => line.startsWith('data: '));
      if (data) yield JSON.parse(data.slice(6)) as AssistantStreamEvent;
      separator = buffer.indexOf('\n\n');
    }
  }
}

/** Website assistant conversation state with streaming answers. */
export function useAssistant(open: boolean) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const restored = useRef(false);

  // Restore the last conversation the first time the panel opens.
  useEffect(() => {
    if (!open || restored.current) return;
    restored.current = true;
    const stored = readStored();
    if (!stored) return;
    api
      .get<AssistantConversationView>(`/ai/assistant/conversations/${stored}`)
      .then((view) => {
        setConversationId(view.id);
        setMessages(
          view.messages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            products: m.products,
          })),
        );
      })
      .catch(() => writeStored(null));
  }, [open]);

  const reset = useCallback(() => {
    writeStored(null);
    setConversationId(null);
    setMessages([]);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      const assistantId = `pending-${Date.now()}`;
      setBusy(true);
      setMessages((current) => [
        ...current,
        { id: `user-${Date.now()}`, role: 'user', text: message, products: [] },
        { id: assistantId, role: 'assistant', text: '', products: [], status: 'در حال فکر کردن…' },
      ]);
      const update = (patch: (m: ChatMessage) => ChatMessage) =>
        setMessages((current) => current.map((m) => (m.id === assistantId ? patch(m) : m)));

      try {
        const response = await fetch('/api/v1/ai/assistant/messages', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
          body: JSON.stringify({ message, conversationId }),
        });
        if (!response.ok || !response.body) {
          const body: unknown = await response.json().catch(() => null);
          if (response.status === 404 || response.status === 409) reset();
          throw toApiError(response.status, body);
        }
        for await (const event of readEvents(response.body)) {
          switch (event.type) {
            case 'conversation':
              setConversationId(event.conversationId);
              writeStored(event.conversationId);
              break;
            case 'text':
              update((m) => ({ ...m, text: m.text + event.delta, status: null }));
              break;
            case 'tool':
              update((m) => ({ ...m, status: `${event.label}…` }));
              break;
            case 'products':
              update((m) => ({ ...m, products: event.products }));
              break;
            case 'done':
              update((m) => ({ ...m, id: event.messageId || m.id, status: null }));
              break;
            case 'error':
              update((m) => ({ ...m, text: m.text || event.message, status: null, error: true }));
              break;
          }
        }
      } catch (error) {
        update((m) => ({ ...m, text: errorMessage(error), status: null, error: true }));
      } finally {
        update((m) => ({ ...m, status: null }));
        setBusy(false);
      }
    },
    [busy, conversationId, reset],
  );

  return { messages, busy, send, reset };
}
