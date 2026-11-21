import { expect, test } from "@playwright/test";
import { noConsoleErrors, alertOf, go } from "./helpers";

const noHScroll = async (page: import("@playwright/test").Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test("landing page: hero, sections, CTA, legal links, responsive nav", async ({ page }, info) => {
  const errors = noConsoleErrors(page);
  await go(page, "/");
  await expect(page.getByRole("heading", { level: 1, name: "Practise interviews. Walk in calm." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Four steps, about ten minutes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practise the rounds campus recruiters use" })).toBeVisible();
  for (const r of ["HR Round", "Technical Round", "Coding Round", "Managerial Round"]) await expect(page.getByRole("heading", { name: r })).toBeVisible();
  const how = page.getByRole("link", { name: "How it works", exact: true });
  if (info.project.name === "desktop") await expect(how).toBeVisible(); else await expect(how).toBeHidden();   // hidden on mobile per design
  await noHScroll(page);
  await page.screenshot({ path: `e2e-shots/${info.project.name}-01-landing.png`, fullPage: true });
  await page.getByRole("link", { name: "Start practising free" }).click();
  await expect(page).toHaveURL(/\/signin$/);
  expect(errors).toEqual([]);
});

test("sign-in page: Google button and graceful message when the provider is not enabled", async ({ page, request }, info) => {
  await go(page, "/signin");
  await expect(page.getByRole("heading", { name: "Welcome to Skillora" })).toBeVisible();
  const btn = page.getByRole("button", { name: "Continue with Google" });
  await expect(btn).toBeVisible();
  await page.screenshot({ path: `e2e-shots/${info.project.name}-02-signin.png` });
  const settings = await request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } });
  const googleOn = (await settings.json()).external?.google === true;
  if (googleOn) { test.info().annotations.push({ type: "note", description: "Google provider is enabled: not clicking through to accounts.google.com" }); return; }
  await btn.click();
  await expect(alertOf(page)).toContainText("Google sign-in has not been switched on");
  await expect(page).toHaveURL(/\/signin$/);   // no raw JSON error page
});

test("protected routes redirect anonymous visitors to sign-in", async ({ page }) => {
  for (const path of ["/practice", "/history", "/settings", "/feedback/aaaaaaaa-0000-4000-8000-000000000002", "/interview/aaaaaaaa-0000-4000-8000-000000000001", "/onboarding/terms"]) {
    await go(page, path);
    await expect(page).toHaveURL(/\/signin$/);
  }
});

test("legal pages are public and show the current version", async ({ page }) => {
  await go(page, "/legal/terms");
  await expect(page.getByRole("heading", { name: "Terms and Conditions" })).toBeVisible();
  await expect(page.getByText("version 2026-11-20")).toBeVisible();
  await go(page, "/legal/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByText("We do not record or store any video.")).toBeVisible();
});

test("signed-out page", async ({ page }, info) => {
  await go(page, "/signed-out");
  await expect(page.getByRole("heading", { name: "You have been signed out" })).toBeVisible();
  await page.screenshot({ path: `e2e-shots/${info.project.name}-04-signed-out.png` });
  await expect(page.getByRole("link", { name: "Sign in again" })).toBeVisible();
});

test("security headers are present", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBeTruthy();
  expect(h["x-powered-by"]).toBeUndefined();
});

test("dev-only login does not exist in production builds", async ({ page }) => {
  const res = await go(page, "/dev-login");
  expect(res?.status()).toBe(404);
});
