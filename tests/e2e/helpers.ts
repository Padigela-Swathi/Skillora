import { createServerClient } from "@supabase/ssr";
import type { BrowserContext, Page } from "@playwright/test";

export const IDS = {
  live: "aaaaaaaa-0000-4000-8000-000000000001",
  done: "aaaaaaaa-0000-4000-8000-000000000002",
  doneHr: "aaaaaaaa-0000-4000-8000-000000000003",
  doneEnded: "aaaaaaaa-0000-4000-8000-000000000004",
  codingQ: "aaaaaaaa-0000-4000-8000-000000000013",
};
export const USERS = {
  a: { email: process.env.E2E_EMAIL_A ?? "e2e-a@skillora-test.invalid", password: process.env.E2E_PASSWORD ?? "" },
  b: { email: process.env.E2E_EMAIL_B ?? "e2e-b@skillora-test.invalid", password: process.env.E2E_PASSWORD ?? "" },
};

/** Signs a test user in with the real Supabase Auth API and returns the cookies @supabase/ssr would set. */
export async function sessionCookies(user: { email: string; password: string }, baseURL: string) {
  const jar = new Map<string, string>();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((c) => jar.set(c.name, c.value)) },
  });
  const { error } = await sb.auth.signInWithPassword(user);
  if (error) throw new Error(`test sign-in failed: ${error.message}`);
  return [...jar].map(([name, value]) => ({ name, value, url: baseURL }));
}

export async function login(context: BrowserContext, who: "a" | "b", baseURL: string) {
  await context.addCookies(await sessionCookies(USERS[who], baseURL));
}

export const noConsoleErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR/.test(m.text())) errors.push(`console: ${m.text()}`); });
  return errors;
};

/** App alerts only (Next.js adds its own role="alert" route announcer, which must not match). */
export const alertOf = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

/** page.goto + wait until React has hydrated (clicks before hydration are silently lost in production builds). */
export async function go(page: Page, url: string) {
  const res = await page.goto(url);
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  return res;
}
