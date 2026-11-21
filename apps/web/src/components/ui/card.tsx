import type * as React from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-xl border border-border bg-bg p-6", className)} {...props} />;
}

export function Alert({ tone = "info", className, ...props }: { tone?: "info" | "error" | "ok" } & HTMLAttributes<HTMLDivElement>) {
  const tones = {
    info: "border-border bg-surface text-text",
    error: "border-[var(--sev-critical)] bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]",
    ok: "border-[var(--ok)] bg-ok-bg text-ok",
  } as const;
  return <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-sm", tones[tone], className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-4", className)} />;
}

/** Page-shaped placeholder while data loads (skeleton, not a spinner). */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="space-y-3 rounded-xl border border-border bg-bg p-6">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={i % 2 ? "w-2/3" : "w-full"} />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-10 text-center">
      <p className="font-display text-lg">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** A page section: heading + hairline. Use instead of a Card when nothing needs elevating. */
export function PageSection({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-border pt-6", className)}>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
