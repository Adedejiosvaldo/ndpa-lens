"use client";

import React from "react";
import { ChevronRight, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { CheckStatus, ClauseStatus } from "@/types/audit";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "brand";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-input",
  brand: "bg-brand text-white hover:bg-brand-fg shadow-input",
  secondary:
    "border border-line-strong bg-surface text-fg hover:bg-subtle shadow-input",
  ghost: "text-fg-muted hover:bg-subtle hover:text-fg",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-7 rounded-md px-2.5 text-xs",
  md: "h-8 rounded-lg px-3 text-[13px]",
  lg: "h-10 rounded-lg px-4 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Labels / badges                                                     */
/* ------------------------------------------------------------------ */

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "brand";

const toneClasses: Record<Tone, string> = {
  ok: "border-ok-line bg-ok-subtle text-ok",
  warn: "border-warn-line bg-warn-subtle text-warn",
  bad: "border-bad-line bg-bad-subtle text-bad",
  info: "border-info-line bg-info-subtle text-info",
  neutral: "border-line bg-subtle text-fg-muted",
  brand: "border-transparent bg-brand-subtle text-brand-fg",
};

export function Badge({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-px text-2xs font-medium",
        toneClasses[tone],
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

export const toneText: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  info: "text-info",
  neutral: "text-fg-muted",
  brand: "text-brand-fg",
};

export const toneBar: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-bar-warn",
  bad: "bg-bad",
  info: "bg-info",
  neutral: "bg-fg-subtle",
  brand: "bg-brand",
};

export function checkTone(status: CheckStatus): Tone {
  if (status === "pass") return "ok";
  if (status === "warning") return "warn";
  if (status === "fail") return "bad";
  return "neutral";
}

export function checkLabel(status: CheckStatus): string {
  if (status === "pass") return "Pass";
  if (status === "warning") return "Warning";
  if (status === "fail") return "Fail";
  return "Info";
}

export function clauseTone(status: ClauseStatus): Tone {
  if (status === "found") return "ok";
  if (status === "partial") return "warn";
  if (status === "missing") return "bad";
  return "neutral";
}

export function clauseLabel(status: ClauseStatus): string {
  if (status === "found") return "Present";
  if (status === "partial") return "Partial";
  if (status === "missing") return "Missing";
  return "Unavailable";
}

export function scoreTone(pct: number): Tone {
  if (pct >= 75) return "ok";
  if (pct >= 50) return "warn";
  return "bad";
}

/* ------------------------------------------------------------------ */
/* Layout pieces                                                       */
/* ------------------------------------------------------------------ */

export function Box({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cx("box overflow-hidden", className)}>{children}</div>;
}

export function BoxHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line bg-subtle px-4 py-3",
        className
      )}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
      <div>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {description && (
          <p className="mt-0.5 max-w-2xl text-[13px] text-fg-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="box p-4">
      <div className="text-xs font-medium text-fg-muted">{label}</div>
      <div
        className={cx(
          "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
          tone ? toneText[tone] : "text-fg"
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-fg-muted">{hint}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "brand",
  className,
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-track", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx("h-full rounded-full transition-all duration-500", toneBar[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-subtle">
        <Icon className="h-5 w-5 text-fg-muted" />
      </div>
      <div className="mt-3 text-sm font-semibold text-fg">{title}</div>
      {children && (
        <div className="mt-1 max-w-sm text-[13px] text-fg-muted">{children}</div>
      )}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; label: string; count?: number }>;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border border-line-strong bg-subtle p-0.5"
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={cx(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition",
              active
                ? "bg-surface text-fg shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:bg-line"
                : "text-fg-muted hover:text-fg"
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className="tabular-nums text-fg-subtle">{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Counter({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-track px-1.5 text-2xs font-medium tabular-nums text-fg">
      {children}
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect width="24" height="24" rx="6" className="fill-fg" />
      <rect x="5" y="6" width="4.5" height="12" rx="1.2" fill="#00a862" />
      <rect x="14.5" y="6" width="4.5" height="12" rx="1.2" fill="#00a862" />
      <circle cx="12" cy="12" r="2" className="fill-canvas" />
    </svg>
  );
}

export function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------ */
/* Theme toggle                                                        */
/* ------------------------------------------------------------------ */

type ThemePref = "system" | "light" | "dark";

function applyTheme(pref: ThemePref) {
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [pref, setPref] = React.useState<ThemePref | null>(null);

  React.useEffect(() => {
    let saved: ThemePref = "system";
    try {
      const raw = localStorage.getItem("theme");
      if (raw === "light" || raw === "dark" || raw === "system") saved = raw;
    } catch {
      /* storage blocked */
    }
    setPref(saved);
  }, []);

  React.useEffect(() => {
    if (!pref) return;
    applyTheme(pref);
    try {
      localStorage.setItem("theme", pref);
    } catch {
      /* storage blocked */
    }
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const options: Array<{ id: ThemePref; icon: LucideIcon; label: string }> = [
    { id: "system", icon: Monitor, label: "System theme" },
    { id: "light", icon: Sun, label: "Light theme" },
    { id: "dark", icon: Moon, label: "Dark theme" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center rounded-full border border-line p-0.5"
    >
      {options.map((o) => {
        const active = pref === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => setPref(o.id)}
            className={cx(
              "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
              active ? "bg-subtle text-fg dark:bg-line" : "text-fg-subtle hover:text-fg"
            )}
          >
            <o.icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Disclosure: collapsed-by-default detail section                     */
/* ------------------------------------------------------------------ */

export function Disclosure({
  title,
  description,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="box overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-subtle"
      >
        <ChevronRight
          className={cx("h-4 w-4 shrink-0 text-fg-subtle transition-transform", open && "rotate-90")}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-fg">{title}</div>
          {description && <div className="mt-0.5 text-xs text-fg-muted">{description}</div>}
        </div>
        {meta && <div className="shrink-0 text-xs text-fg-muted">{meta}</div>}
      </button>
      {open && <div className="animate-fade-in border-t border-line bg-canvas p-4">{children}</div>}
    </div>
  );
}
