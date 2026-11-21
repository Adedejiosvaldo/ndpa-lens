import { type InputHTMLAttributes, type SelectHTMLAttributes, useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text transition-[border-color,box-shadow] duration-150 placeholder:text-muted hover:border-[color-mix(in_oklab,var(--border)_60%,var(--text))] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none aria-[invalid=true]:border-[var(--sev-critical)] disabled:cursor-not-allowed disabled:opacity-60";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
}

/** Label + input + hint/error, wired with ids for screen readers. */
export function Field({ label, error, hint, className, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={control} {...props} />
      {error ? (
        <p id={`${id}-err`} className="text-xs text-[var(--sev-critical)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({ label, children, className, ...props }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select id={id} className={control} {...props}>
        {children}
      </select>
    </div>
  );
}
