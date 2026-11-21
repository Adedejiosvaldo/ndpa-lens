import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
      <Link href="/" className="mb-6 text-lg font-semibold text-accent">
        NDPA Lens
      </Link>
      <div className="w-full max-w-md rounded-lg border border-border bg-bg p-8">{children}</div>
    </main>
  );
}
