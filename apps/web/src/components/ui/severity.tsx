import { SEVERITY_LABEL, type Severity } from "@ndpa/schema";
import { cn } from "@/lib/cn";

/** Colour plus a text label, never colour alone (PRD §3.1). */
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold", className)}
      style={{ color: `var(--sev-${severity})`, background: `var(--sev-${severity}-bg)` }}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
