import type { Metadata } from 'next';
import { safeNext } from '@/lib/safe-next';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'ثبت‌نام', robots: { index: false } };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  return <RegisterForm next={safeNext(next)} />;
}
