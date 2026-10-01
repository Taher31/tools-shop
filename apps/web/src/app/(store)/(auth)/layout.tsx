import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-10 md:py-16">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm md:p-8">{children}</div>
    </div>
  );
}
