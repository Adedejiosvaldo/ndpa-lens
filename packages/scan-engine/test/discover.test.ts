import { describe, expect, it } from "vitest";
import { classify, discoverPages } from "../src/index.js";

const HOME = "https://harbourassurance.ng/";
const page = (links: string) => `<html><body><nav>${links}</nav><footer><a href="/privacy-policy">Privacy policy</a></footer></body></html>`;

describe("SCAN-02 discovery", () => {
  it("starts with the homepage and the user's named pages", () => {
    const r = discoverPages(page('<a href="/about">About</a>'), HOME, ["/claims/new", "https://www.harbourassurance.ng/agents"]);
    expect(r.slice(0, 3).map((p) => [p.source, p.url])).toEqual([
      ["home", HOME],
      ["named", "https://harbourassurance.ng/claims/new"],
      ["named", "https://www.harbourassurance.ng/agents"],
    ]);
  });

  it("ranks policy, sign-up, checkout, login and contact pages ahead of the rest", () => {
    const html = page(`
      <a href="/about">About us</a><a href="/blog">Blog</a>
      <a href="/contact-us">Contact</a><a href="/login">Log in</a>
      <a href="/get-a-quote">Get a quote</a><a href="/buy/motor">Buy motor cover</a>
      <a href="/register">Create an account</a><a href="/cookie-notice">Cookies</a><a href="/careers">Careers</a>`);
    const types = discoverPages(html, HOME).map((p) => p.pageType);
    expect(types.slice(0, 9)).toEqual(["home", "policy", "cookie", "signup", "checkout", "login", "contact", "careers", "other"]);
    // A keyword page ("quote") outranks a plain one.
    const others = discoverPages(html, HOME).filter((p) => p.pageType === "other").map((p) => new URL(p.url).pathname);
    expect(others[0]).toBe("/get-a-quote");
  });

  it("drops off-site links, files, logout and duplicates, and keeps subdomains", () => {
    const html = page(`
      <a href="https://evil.test/signup">Sign up</a><a href="/brochure.pdf">Brochure</a>
      <a href="/logout">Log out</a><a href="/login#top">Log in</a><a href="/login/">Log in</a>
      <a href="https://portal.harbourassurance.ng/login">Portal</a><a href="mailto:info@harbour.ng">Mail</a>`);
    const urls = discoverPages(html, HOME).map((p) => p.url);
    expect(urls.some((u) => u.includes("evil.test") || u.endsWith(".pdf") || u.includes("logout") || u.startsWith("mailto"))).toBe(false);
    expect(urls.filter((u) => u.startsWith("https://harbourassurance.ng/login"))).toHaveLength(1);
    expect(urls).toContain("https://portal.harbourassurance.ng/login");
  });

  it("caps at 25 pages and is deterministic", () => {
    const many = Array.from({ length: 60 }, (_, i) => `<a href="/p/${i}">Page ${i}</a>`).join("");
    const a = discoverPages(page(many), HOME, ["/named"]);
    const b = discoverPages(page(many), HOME, ["/named"]);
    expect(a).toHaveLength(25);
    expect(a).toEqual(b);
  });

  it("classifies pages by path and link text", () => {
    expect(classify("https://x.ng/data-protection").type).toBe("policy");
    expect(classify("https://x.ng/a", "Open an account").type).toBe("signup");
    expect(classify("https://x.ng/vacancies").type).toBe("careers");
    expect(classify("https://x.ng/news").type).toBe("other");
  });
});
