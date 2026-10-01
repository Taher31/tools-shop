import { Button } from '@toolshop/ui';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-7xl font-extrabold text-primary/20">۴۰۴</p>
      <h1 className="text-xl font-extrabold">صفحه مورد نظر پیدا نشد</h1>
      <p className="max-w-md text-sm leading-7 text-muted-foreground">
        ممکن است آدرس اشتباه وارد شده باشد یا این کالا دیگر در فروشگاه موجود نباشد.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/">صفحه اصلی</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/products">مشاهده محصولات</Link>
        </Button>
      </div>
    </div>
  );
}
