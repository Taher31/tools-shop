import type { CategoryTreeNode } from '@toolshop/shared';
import { ChevronDown, LayoutGrid } from 'lucide-react';
import Link from 'next/link';

/** Desktop navigation with CSS-only mega menus (works without JavaScript, keyboard via focus-within). */
export function CategoryNav({ tree }: { tree: CategoryTreeNode[] }) {
  return (
    <nav aria-label="دسته‌بندی کالاها" className="hidden bg-nav text-nav-foreground lg:block">
      <div className="container-page flex h-11 items-stretch gap-1 text-sm">
        <Link href="/products" className="flex items-center gap-2 px-3 font-semibold text-accent hover:bg-white/10">
          <LayoutGrid className="size-4" />
          همه کالاها
        </Link>
        {tree.map((category) => (
          <div key={category.id} className="group relative flex items-stretch">
            <Link
              href={`/category/${category.slug}`}
              className="flex items-center gap-1 px-3 hover:bg-white/10 group-focus-within:bg-white/10"
            >
              {category.name}
              {category.children.length > 0 ? <ChevronDown className="size-3.5 opacity-70" /> : null}
            </Link>
            {category.children.length > 0 ? (
              <div className="invisible absolute start-0 top-full z-40 w-[min(46rem,80vw)] translate-y-1 rounded-b-md border border-t-0 border-border bg-popover text-popover-foreground opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div className="grid grid-cols-3 gap-x-6 gap-y-4 p-5">
                  {category.children.map((child) => (
                    <div key={child.id}>
                      <Link
                        href={`/category/${child.slug}`}
                        className="mb-1.5 block border-s-2 border-accent ps-2 font-bold text-foreground hover:text-primary"
                      >
                        {child.name}
                      </Link>
                      <ul className="space-y-1">
                        {child.children.map((grandchild) => (
                          <li key={grandchild.id}>
                            <Link href={`/category/${grandchild.slug}`} className="text-[13px] text-muted-foreground hover:text-primary">
                              {grandchild.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border bg-muted/50 px-5 py-2 text-xs">
                  <Link href={`/category/${category.slug}`} className="font-medium text-info hover:underline">
                    مشاهده همه {category.name}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        <Link href="/products?onSale=true" className="flex items-center px-3 hover:bg-white/10">
          تخفیف‌ها
        </Link>
        <Link href="/compare" className="ms-auto flex items-center px-3 text-nav-foreground/80 hover:bg-white/10">
          مقایسه کالا
        </Link>
      </div>
    </nav>
  );
}
