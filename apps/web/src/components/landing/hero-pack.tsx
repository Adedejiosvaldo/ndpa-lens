"use client";

import type * as React from "react";
import { useEffect, useRef } from "react";

/**
 * Hero focal asset: a sample evidence pack composed in real HTML (white-label
 * cover, a finding with its evidence, the data-flow strip and manifest hash).
 * Fine pointers tilt it slightly; touch, keyboard and reduced motion get the
 * static, complete composition.
 */
export function HeroPack() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    const stack = el.querySelector<HTMLElement>("[data-stack]")!;
    let rx = (_: number) => {};
    let ry = (_: number) => {};
    let kill = () => {};
    // GSAP arrives after hydration (shared chunk with LandingMotion); until then the pack is static.
    void import("gsap").then(({ default: gsap }) => {
      rx = gsap.quickTo(stack, "rotationX", { duration: 0.6, ease: "power3.out" });
      ry = gsap.quickTo(stack, "rotationY", { duration: 0.6, ease: "power3.out" });
      kill = () => gsap.killTweensOf(stack);
    });
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        ry(x * 7);
        rx(-y * 6);
      });
    };
    const reset = () => (rx(0), ry(0));
    const onVisibility = () => document.hidden && reset();
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", onVisibility);
      kill();
    };
  }, []);

  return (
    <div ref={root} className="relative [perspective:1400px]" aria-label="Sample evidence pack (illustrative)" role="img">
      <div data-stack className="relative mx-auto aspect-[4/5] w-full max-w-[460px] [transform-style:preserve-3d]">
        {/* Page 3 — data flows */}
        <div data-pack-page style={{ "--i": 0 } as React.CSSProperties} className="absolute inset-x-6 top-0 rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-paper)] [transform:translateZ(-60px)_rotate(4deg)]">
          <p className="font-mono text-[10px] tracking-wide text-muted">C · CROSS-BORDER DATA FLOWS</p>
          <ul className="mt-3 space-y-2 font-mono text-[11px]">
            <li className="flex justify-between"><span>connect.facebook.net</span><span className="text-muted">IE · before consent</span></li>
            <li className="flex justify-between"><span>www.google-analytics.com</span><span className="text-muted">US · before consent</span></li>
            <li className="flex justify-between"><span>js.paystack.co</span><span className="text-muted">NG · necessary</span></li>
          </ul>
        </div>
        {/* Page 2 — a finding */}
        <div data-pack-page style={{ "--i": 1 } as React.CSSProperties} className="absolute inset-x-2 top-[29%] rounded-lg border border-border bg-bg p-5 shadow-[var(--shadow-paper)] [transform:translateZ(-20px)_rotate(-2deg)]">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-wide text-muted">B-01 · CONSENT</p>
            <span className="rounded px-2 py-0.5 text-[11px] font-semibold" style={{ color: "var(--sev-critical)", background: "var(--sev-critical-bg)" }}>
              Critical
            </span>
          </div>
          <p className="mt-2 font-display text-xl leading-snug">Meta Pixel loads before the visitor consents</p>
          <p className="mt-2 rounded bg-surface px-2 py-1.5 font-mono text-[10.5px] leading-relaxed text-muted">
            GET connect.facebook.net/en_US/fbevents.js
            <br />
            state: no interaction · 14 Feb 2027 10:42:07 WAT
          </p>
          <p className="mt-2 text-xs text-muted">NDPA s.25–26 · lawful basis and consent</p>
        </div>
        {/* Page 1 — white-label cover */}
        <div data-pack-page style={{ "--i": 2 } as React.CSSProperties} className="absolute inset-x-0 bottom-0 rounded-lg border border-border bg-bg p-6 shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: "#7a2e1d" }}>
              Adeyemi &amp; Co
            </span>
            <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">SAMPLE</span>
          </div>
          <p className="mt-6 font-mono text-[10px] tracking-wide text-muted">NDPA TECHNICAL EVIDENCE PACK · v2</p>
          <p className="mt-1 font-display text-2xl leading-tight">Harbour Assurance Plc</p>
          <p className="mt-1 text-xs text-muted">harbourassurance.ng · 12 pages · 3 consent states</p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              ["3", "Critical", "critical"],
              ["5", "High", "high"],
              ["9", "Medium", "medium"],
            ].map(([n, l, s]) => (
              <div key={l} className="rounded-md py-2" style={{ background: `var(--sev-${s}-bg)` }}>
                <p className="font-display text-xl tabular" style={{ color: `var(--sev-${s})` }}>
                  {n}
                </p>
                <p className="text-[10px] text-muted">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-border pt-3 font-mono text-[10px] text-muted">
            <span>sha256 9f2c41ab…e70dc3f5</span>
            <span className="text-ok">signed ✓</span>
          </div>
        </div>
      </div>
      <p className="mt-6 text-center font-mono text-[10px] text-muted">Illustrative sample. Firm and client names are fictional.</p>
    </div>
  );
}
