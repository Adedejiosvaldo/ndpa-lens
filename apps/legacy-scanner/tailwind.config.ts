import type { Config } from "tailwindcss";

// Colours come from CSS variables in globals.css so light/dark themes swap in one place.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: v("canvas"),
        surface: v("surface"),
        subtle: v("subtle"),
        line: v("line"),
        "line-strong": v("line-strong"),
        track: v("track"),
        fg: v("fg"),
        "fg-muted": v("fg-muted"),
        "fg-subtle": v("fg-subtle"),
        primary: {
          DEFAULT: v("primary"),
          fg: v("primary-fg"),
          hover: v("primary-hover"),
        },
        brand: { DEFAULT: v("brand"), fg: v("brand-fg"), subtle: v("brand-subtle") },
        ok: { DEFAULT: v("ok"), subtle: v("ok-subtle"), line: v("ok-line") },
        warn: { DEFAULT: v("warn"), subtle: v("warn-subtle"), line: v("warn-line") },
        bad: { DEFAULT: v("bad"), subtle: v("bad-subtle"), line: v("bad-line") },
        info: { DEFAULT: v("info"), subtle: v("info-subtle"), line: v("info-line") },
        "bar-warn": v("bar-warn"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        card: "0 1px 0 rgb(var(--shadow) / 0.04)",
        pop: "0 8px 24px rgb(var(--shadow) / 0.18), 0 0 0 1px rgb(var(--shadow) / 0.06)",
        input: "0 1px 2px rgb(var(--shadow) / 0.04)",
        hero: "0 1px 2px rgb(var(--shadow) / 0.04), 0 12px 40px -12px rgb(var(--shadow) / 0.14)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 240ms ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
