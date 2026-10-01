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
import { useState } from 'react';

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
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    // Navigated: close the menu (state adjusted during render, no effect needed).
    setMenuPath(pathname);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="منو">
          <Menu className="size-6" />
        </Button>
      </DialogTrigger>
      <SheetContent title="منو" side="start" aria-describedby={undefined}>
        <div className="p-2">
          <Link
            href="/products"
            className="text-primary hover:bg-muted block rounded-md px-3 py-2.5 font-bold"
          >
            همه کالاها
          </Link>
          <Accordion type="multiple" className="px-3">
            {tree.map((category) => (
              <AccordionItem key={category.id} value={category.id}>
                <AccordionTrigger>{category.name}</AccordionTrigger>
                <AccordionContent className="pb-3">
                  <ul className="space-y-1">
                    <li>
                      <Link href={`/category/${category.slug}`} className="text-info block py-1">
                        همه {category.name}
                      </Link>
                    </li>
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/category/${child.slug}`}
                          className="text-foreground block py-1"
                        >
                          {child.name}
                        </Link>
                        {child.children.length > 0 ? (
                          <ul className="border-border ms-3 border-s ps-3">
                            {child.children.map((grandchild) => (
                              <li key={grandchild.id}>
                                <Link
                                  href={`/category/${grandchild.slug}`}
                                  className="text-muted-foreground block py-1 text-[13px]"
                                >
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
          <ul className="border-border mt-2 border-t pt-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:bg-muted block rounded-md px-3 py-2.5 text-sm"
                >
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
