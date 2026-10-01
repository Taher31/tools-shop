'use client';

import { toast } from '@toolshop/ui';
import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'toolshop:compare';
export const MAX_COMPARE = 4;
const listeners = new Set<() => void>();
let cached: string[] | null = null;

function read(): string[] {
  if (cached) return cached;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    cached = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_COMPARE)
      : [];
  } catch {
    cached = [];
  }
  return cached;
}

function write(ids: string[]): void {
  cached = ids;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // storage unavailable (private mode): keep in memory only
  }
  listeners.forEach((listener) => listener());
}

const EMPTY: string[] = [];

/** Product comparison list kept in the browser (no account needed). */
export function useCompare() {
  const ids = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => EMPTY,
  );

  const toggle = useCallback((productId: string) => {
    const current = read();
    if (current.includes(productId)) {
      write(current.filter((id) => id !== productId));
      return;
    }
    if (current.length >= MAX_COMPARE) {
      toast.warning(`حداکثر ${MAX_COMPARE} کالا را می‌توانید مقایسه کنید.`);
      return;
    }
    write([...current, productId]);
    toast.success('به لیست مقایسه اضافه شد.');
  }, []);

  const remove = useCallback(
    (productId: string) => write(read().filter((id) => id !== productId)),
    [],
  );
  const clear = useCallback(() => write([]), []);

  return { ids, toggle, remove, clear, has: (productId: string) => ids.includes(productId) };
}
