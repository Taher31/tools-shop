import type { Metadata } from 'next';
import { WishlistView } from './wishlist-view';

export const metadata: Metadata = { title: 'علاقه‌مندی‌ها', robots: { index: false } };

export default function WishlistPage() {
  return (
    <div className="container-page py-6">
      <h1 className="mb-5 text-xl font-extrabold">علاقه‌مندی‌ها</h1>
      <WishlistView />
    </div>
  );
}
