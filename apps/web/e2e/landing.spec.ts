import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("is accessible and leads to sign-up", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Prove what a client's website does with personal data." })).toBeVisible();
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    // Exactly one smooth-scroll engine (Lenis), no Locomotive.
    await expect(page.locator("html")).toHaveClass(/lenis/);
    expect(await page.locator("[data-scroll-container]").count()).toBe(0);

    await page.getByRole("link", { name: "Create your workspace" }).first().click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("keyboard users can skip to content and reach the CTA", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("with reduced motion everything is visible and nothing smooth-scrolls", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveClass(/lenis/);
    for (const name of ["Hand-gathered evidence is easy to dispute.", "What you hand your client.", "Start with your next client."]) {
      const h = page.getByRole("heading", { name });
      await h.scrollIntoViewIfNeeded();
      await expect(h).toBeVisible();
    }
    // Every step is fully shown (no scrub dimming).
    await expect(page.locator("[data-how]")).not.toHaveAttribute("data-scrub", "");
    await ctx.close();
  });
});
