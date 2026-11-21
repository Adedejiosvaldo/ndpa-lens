import Link from "next/link";
import { cn } from "@/lib/cn";

/** Wordmark: a lens ring over a ruled line — simple authored mark, not an illustration. */
export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 24 24" className="size-5 text-accent" aria-hidden>
        <circle cx="12" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M4 21h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="11" r="2.25" fill="currentColor" />
      </svg>
      <span>
        NDPA <span className="text-accent">Lens</span>
      </span>
    </Link>
  );
}
