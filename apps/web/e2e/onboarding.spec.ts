import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { latestEmail, linkIn, PASSWORD, totp, unique } from "./helpers";

/** Opt-in design review captures: E2E_SHOTS=<dir> pnpm test:e2e */
const shot = async (page: Page, name: string) => {
  const dir = process.env.E2E_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/app-${name}.png`, fullPage: true });
};

async function noSeriousA11yIssues(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help}`), `axe on ${name}`).toEqual([]);
}

test("DPCO founder signs up, enrols MFA, invites a colleague who joins", async ({ page, browser }) => {
  const founder = unique("founder");
  const colleague = unique("colleague");

  // Sign up with the organisation (AUTH-01, ORG-01)
  await page.goto("/signup");
  await noSeriousA11yIssues(page, "signup");
  await page.getByLabel("Your name").fill("Funmi Adeyemi");
  await page.getByLabel("Work email").fill(founder);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await expect(page.getByText(/Password strength:/)).toBeVisible();
  await page.getByLabel("Registered (legal) name").fill("Adeyemi & Co Legal Practitioners");
  await page.getByLabel("Trading name").fill("Adeyemi & Co");
  await page.getByLabel("Address").fill("12 Awolowo Road, Ikoyi, Lagos");
  await page.getByLabel("Phone").fill("+234 803 000 1111");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // Verify email (AUTH-02) → Owners land on MFA set-up
  await page.goto(linkIn((await latestEmail(founder, /Confirm your email/)).text));
  await expect(page).toHaveURL(/\/settings\/security\?setup=1/);
  await expect(page.getByText("Owners must use two-factor authentication")).toBeVisible();

  // Enrol MFA (AUTH-05)
  await page.getByLabel("Confirm your password").fill(PASSWORD);
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await expect(page.getByAltText("QR code for your authenticator app")).toBeVisible();
  await expect(page.getByTestId("recovery-codes").locator("li")).toHaveCount(10);
  await shot(page, "security-enrol");
  await noSeriousA11yIssues(page, "security (enrol)");
  const key = (await page.getByTestId("manual-key").textContent())!.trim();
  await page.getByLabel("Code", { exact: true }).fill(totp(key));
  await page.getByRole("button", { name: "Turn on two-factor authentication" }).click();
  await expect(page.getByText("Two-factor authentication is on.")).toBeVisible();

  // Invite a colleague (ORG-04)
  await page.getByRole("link", { name: "Members" }).click();
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
  await noSeriousA11yIssues(page, "members");
  await page.getByLabel("Email").fill(colleague);
  await page.getByLabel("Role").selectOption("analyst");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText(`Invitation sent to ${colleague}`)).toBeVisible();
  const pending = page.getByRole("row", { name: new RegExp(colleague) });
  await expect(pending).toContainText("Analyst");
  await shot(page, "members");

  // The colleague accepts in their own browser: create account (no org), verify, join
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(linkIn((await latestEmail(colleague, /invited you/)).text));
  await p2.getByRole("link", { name: "Create an account" }).click();
  await expect(p2.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(p2.getByLabel("Trading name")).toHaveCount(0);
  await p2.getByLabel("Your name").fill("Chidi Okafor");
  await p2.getByLabel("Work email").fill(colleague);
  await p2.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await p2.getByRole("button", { name: "Create account" }).click();
  await p2.goto(linkIn((await latestEmail(colleague, /Confirm your email/)).text));
  await expect(p2.getByRole("heading", { name: "Join the organisation" })).toBeVisible();
  await p2.getByRole("button", { name: "Accept invitation" }).click();
  await expect(p2.getByRole("heading", { name: "Adeyemi & Co" })).toBeVisible();
  await shot(p2, "org-overview");
  await other.close();

  // The founder sees the new member and the audit trail
  await page.reload();
  await expect(page.getByRole("cell", { name: "Chidi Okafor" })).toBeVisible();
  await page.getByRole("link", { name: "Audit log" }).click();
  await expect(page.getByRole("cell", { name: "Invitation accepted" })).toBeVisible();
  await shot(page, "audit-log");
  await page.getByRole("link", { name: "Organisation" }).click();
  await expect(page.getByLabel("Trading name")).toBeVisible();

  // ORG-02: submit the DPCO licence; BRAND-01: logo, colour and contact on the pack cover
  await page.getByLabel("Licence number", { exact: true }).fill("NDPC/DPCO/2026/0148");
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.getByText("Waiting for verification")).toBeVisible();
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360f8cf00000301010018dd8db00000000049454e44ae426082", "hex");
  await page.locator("#logo-input").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText(/logo$/)).toBeVisible();
  await page.getByLabel("Contact block").fill("12 Awolowo Road, Ikoyi, Lagos");
  await page.getByRole("button", { name: "Save branding" }).click();
  await expect(page.getByText("Branding saved.")).toBeVisible();
  await expect(page.getByLabel("Pack cover preview")).toContainText("DPCO licence NDPC/DPCO/2026/0148");
  await noSeriousA11yIssues(page, "organisation settings");
  await shot(page, "org-settings");
});

test("a wrong password gets a clear error, and the login page is accessible", async ({ page }) => {
  await page.goto("/login");
  await noSeriousA11yIssues(page, "login");
  await page.getByLabel("Email").fill("nobody@e2e.test");
  await page.getByLabel("Password").fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email or password is incorrect" })).toBeVisible();
});
