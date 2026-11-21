import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-6 py-8 sm:px-12">
      <Brand />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col justify-center">
        <p className="font-mono text-xs text-muted">404 · NO RECORD</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">We couldn't find that page.</h1>
        <p className="mt-3 max-w-md text-muted">The link may be old, or the page may have moved. If you followed an invitation or a reset link, ask for a new one.</p>
        <div className="mt-8 flex gap-3">
          <Button asChild>
            <Link href="/">Go to the home page</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
