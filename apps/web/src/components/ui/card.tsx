import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-bg p-6", className)} {...props} />;
}

export function Alert({ tone = "info", className, ...props }: { tone?: "info" | "error" | "ok" } & HTMLAttributes<HTMLDivElement>) {
  const tones = {
    info: "border-border bg-surface text-text",
    error: "border-[var(--sev-critical)] bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]",
    ok: "border-[var(--ok)] bg-ok-bg text-ok",
  } as const;
  return <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-sm", tones[tone], className)} {...props} />;
}
