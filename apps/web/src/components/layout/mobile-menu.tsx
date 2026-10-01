'use client';

import type { CategoryTreeNode } from '@toolshop/shared';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Dialog,
  DialogTrigger,
  SheetContent,
} from '@toolshop/ui';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '/products?onSale=true', label: 'تخفیف‌ها' },
  { href: '/compare', label: 'مقایسه کالا' },
  { href: '/account/orders', label: 'پیگیری سفارش' },
  { href: '/faq', label: 'سوالات متداول' },
  { href: '/contact', label: 'تماس با ما' },
  { href: '/about', label: 'درباره ما' },
];

export function MobileMenu({ tree }: { tree: CategoryTreeNode[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="منو">
          <Menu className="size-6" />
        </Button>
      </DialogTrigger>
      <SheetContent title="منو" side="start" aria-describedby={undefined}>
        <div className="p-2">
          <Link href="/products" className="block rounded-md px-3 py-2.5 font-bold text-primary hover:bg-muted">
            همه کالاها
          </Link>
          <Accordion type="multiple" className="px-3">
            {tree.map((category) => (
              <AccordionItem key={category.id} value={category.id}>
                <AccordionTrigger>{category.name}</AccordionTrigger>
                <AccordionContent className="pb-3">
                  <ul className="space-y-1">
                    <li>
                      <Link href={`/category/${category.slug}`} className="block py-1 text-info">
                        همه {category.name}
                      </Link>
                    </li>
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link href={`/category/${child.slug}`} className="block py-1 text-foreground">
                          {child.name}
                        </Link>
                        {child.children.length > 0 ? (
                          <ul className="ms-3 border-s border-border ps-3">
                            {child.children.map((grandchild) => (
                              <li key={grandchild.id}>
                                <Link href={`/category/${grandchild.slug}`} className="block py-1 text-[13px] text-muted-foreground">
                                  {grandchild.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <ul className="mt-2 border-t border-border pt-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="block rounded-md px-3 py-2.5 text-sm hover:bg-muted">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Dialog>
  );
}
