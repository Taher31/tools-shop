'use client';

import { Button } from '@toolshop/ui';
import Link from 'next/link';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-extrabold">متأسفانه مشکلی پیش آمد</h1>
      <p className="max-w-md text-sm leading-7 text-muted-foreground">
        در بارگذاری این صفحه خطایی رخ داد. لطفاً دوباره تلاش کنید؛ اگر مشکل ادامه داشت با پشتیبانی تماس بگیرید.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>تلاش مجدد</Button>
        <Button asChild variant="outline">
          <Link href="/">صفحه اصلی</Link>
        </Button>
      </div>
    </div>
  );
}
