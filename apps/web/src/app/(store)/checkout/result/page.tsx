import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaymentResult } from './payment-result';

export const metadata: Metadata = { title: 'نتیجه پرداخت', robots: { index: false } };

export default function ResultPage() {
  return (
    <div className="container-page flex justify-center py-10">
      <Suspense>
        <PaymentResult />
      </Suspense>
    </div>
  );
}
