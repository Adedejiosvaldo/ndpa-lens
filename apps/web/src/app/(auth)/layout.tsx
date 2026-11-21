import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Brand />
        <main id="main" tabIndex={-1} className="flex flex-1 items-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <p className="text-xs text-muted">Technical evidence, not legal advice. Your DPCO remains responsible for the audit conclusion.</p>
      </div>
      <aside className="grain relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between" aria-label="About NDPA Lens">
        <p className="font-mono text-xs tracking-wide text-ink-muted">EXHIBIT · WEBSITE BEHAVIOUR · NDPA 2023</p>
        <div className="max-w-md">
          <p className="font-display text-4xl leading-[1.1] tracking-tight">Evidence a lawyer can stand behind.</p>
          <p className="mt-4 text-sm leading-relaxed text-[#d1d5db]">
            Every finding carries the screenshot, the request and the consent state it came from. The whole pack is signed, so anyone can check it hasn't changed.
          </p>
        </div>
        <dl className="space-y-2 font-mono text-[11px] text-ink-muted">
          <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
            <dt>manifest.sha256</dt>
            <dd className="truncate text-accent-bright">9f2c…41ab e70d…c3f5</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
            <dt>signature</dt>
            <dd>ed25519 · verified</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
