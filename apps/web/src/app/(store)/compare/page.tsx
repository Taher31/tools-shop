import type { Metadata } from 'next';
import { CompareView } from './compare-view';

export const metadata: Metadata = { title: 'مقایسه محصولات', robots: { index: false } };

export default function ComparePage() {
  return (
    <div className="container-page py-6">
      <h1 className="mb-5 text-xl font-extrabold">مقایسه محصولات</h1>
      <CompareView />
    </div>
  );
}
