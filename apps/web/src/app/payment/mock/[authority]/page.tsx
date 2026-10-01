import type { Metadata } from 'next';
import { MockGateway } from './mock-gateway';

export const metadata: Metadata = { title: 'درگاه پرداخت آزمایشی', robots: { index: false } };

export default async function MockGatewayPage({ params }: { params: Promise<{ authority: string }> }) {
  const { authority } = await params;
  return <MockGateway authority={authority} />;
}
