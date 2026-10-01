import type { Metadata } from 'next';
import { CheckoutView } from './checkout-view';

export const metadata: Metadata = { title: 'تکمیل خرید', robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container-page py-6">
      <h1 className="mb-5 text-xl font-extrabold">تکمیل خرید</h1>
      <CheckoutView />
    </div>
  );
}
