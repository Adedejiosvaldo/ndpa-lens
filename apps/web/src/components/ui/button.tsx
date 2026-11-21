import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-[background-color,color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg shadow-[var(--shadow-paper)] hover:bg-[color-mix(in_oklab,var(--accent)_88%,black)]",
        secondary: "border border-border bg-bg text-text hover:border-[color-mix(in_oklab,var(--border)_60%,var(--text))] hover:bg-surface",
        ghost: "text-text hover:bg-surface-2",
        link: "h-auto px-0 text-accent underline decoration-1 underline-offset-4 hover:decoration-2",
        danger: "bg-[var(--sev-critical)] text-white hover:opacity-90 dark:text-[var(--sev-critical-bg)]",
      },
      size: { sm: "h-8 px-3", md: "h-9 px-4", lg: "h-10 px-5" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, type = "button", ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(button({ variant, size }), className)} type={asChild ? undefined : type} {...props} />;
}
