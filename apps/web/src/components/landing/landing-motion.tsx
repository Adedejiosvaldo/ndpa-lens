"use client";

import { useEffect } from "react";

/**
 * The landing page's scroll motion: one purposeful scrub (how a scan moves
 * through the consent states). The hero intro is CSS (globals.css) so it plays
 * at first paint without waiting for JS. GSAP + ScrollTrigger drive the scrub;
 * Lenis is the only smooth-scroll engine. All three load after hydration, so they never count
 * toward the first paint; under prefers-reduced-motion they never load.
 */
export function LandingMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cleanup = () => {};
    let cancelled = false;

    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("lenis"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      // In-page anchors glide through Lenis. The skip link keeps its native jump.
      const onClick = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
        if (!a || a.getAttribute("href") === "#" || a.classList.contains("skip-link")) return;
        const target = document.querySelector<HTMLElement>(a.getAttribute("href")!);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -72 });
        target.focus({ preventScroll: true });
      };
      document.addEventListener("click", onClick);

      const ctx = gsap.context(() => {
        // How it works (desktop): pin the consent-state panel and mark the active step as you scroll.
        gsap.matchMedia().add("(min-width: 1024px)", () => {
          const how = document.querySelector<HTMLElement>("[data-how]");
          const steps = gsap.utils.toArray<HTMLElement>("[data-step]");
          const states = gsap.utils.toArray<HTMLElement>("[data-state]");
          how?.setAttribute("data-scrub", "");
          ScrollTrigger.create({
            trigger: "[data-how]",
            start: "top top+=96",
            end: "bottom bottom-=96",
            pin: "[data-how-rail]",
            pinSpacing: false,
            onUpdate: (self) => {
              gsap.set("[data-how-progress]", { scaleY: self.progress });
              const active = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
              steps.forEach((s, i) => s.toggleAttribute("data-active", i === active));
              const state = active < 2 ? 0 : Math.min(states.length - 1, active - 1);
              states.forEach((s, i) => s.toggleAttribute("data-active", i <= state));
            },
          });
          return () => how?.removeAttribute("data-scrub");
        });
      });
      void document.fonts?.ready.then(() => ScrollTrigger.refresh());

      cleanup = () => {
        document.removeEventListener("click", onClick);
        ctx.revert();
        gsap.ticker.remove(tick);
        lenis.destroy();
        ScrollTrigger.getAll().forEach((t) => t.kill());
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);
  return null;
}
