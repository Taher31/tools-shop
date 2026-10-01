'use client';

import { Direction } from 'radix-ui';
import type { ReactNode } from 'react';

/** Makes Radix primitives (menus, tabs, sliders) RTL-aware. */
export function DirectionProvider({
  dir = 'rtl',
  children,
}: {
  dir?: 'rtl' | 'ltr';
  children: ReactNode;
}) {
  return <Direction.Provider dir={dir}>{children}</Direction.Provider>;
}
