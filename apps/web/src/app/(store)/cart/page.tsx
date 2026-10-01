import type { Metadata } from 'next';
import { CartView } from './cart-view';

export const metadata: Metadata = { title: 'سبد خرید', robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-page py-6">
      <h1 className="mb-5 text-xl font-extrabold">سبد خرید</h1>
      <CartView />
    </div>
  );
}
