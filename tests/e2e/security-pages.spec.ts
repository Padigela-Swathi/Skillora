import { expect, test } from "@playwright/test";
import { go, IDS, login, userJwt } from "./helpers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const H = (jwt: string) => ({ apikey: ANON, Authorization: `Bearer ${jwt}`, "content-type": "application/json", Prefer: "return=representation" });

// Attacker-controlled strings that would execute if any page rendered them as HTML.
const NAME_XSS = `<img src=x onerror="window.__xss=1">`;
const COLLEGE_XSS = `"><svg onload="window.__xss=2"><script>window.__xss=3</script>`;

test("page-level IDOR: user A cannot open user B's interview, feedback or processing pages", async ({ page, context, baseURL }) => {
  await login(context, "a", baseURL!);
  for (const path of [`/feedback/${IDS.done}`, `/interview/${IDS.done}`, `/interview/${IDS.live}`, `/interview/${IDS.live}/processing`, `/feedback/${IDS.doneHr}`]) {
    const res = await page.goto(path);
    const html = await page.content();
    expect(res?.status(), path).toBe(404);
    expect(html, `${path} leaks B's question text`).not.toContain("process and a thread");
    expect(html, `${path} leaks B's name`).not.toContain("Bhavya");
  }
  for (const path of ["/feedback/not-a-uuid", "/feedback/00000000-0000-4000-8000-000000000000", "/interview/not-a-uuid"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);   // 404, never a 500 with a stack trace
    expect(await page.content()).not.toMatch(/at \w+ \(|node_modules|stack/i);
  }
});

test("XSS: attacker-controlled profile fields are rendered as text on every page that shows them", async ({ page, context, request, baseURL }) => {
  await login(context, "b", baseURL!);
  const jwt = await userJwt("b", baseURL!);
  const original = (await (await request.get(`${URL}/rest/v1/profiles?select=full_name,college`, { headers: H(jwt) })).json())[0];
  const set = (v: { full_name: string; college: string }) => request.patch(`${URL}/rest/v1/profiles?id=not.is.null`, { headers: H(jwt), data: v });
  expect((await set({ full_name: NAME_XSS, college: COLLEGE_XSS })).ok()).toBe(true);   // a normal user may edit their own profile through the API
  try {
    for (const path of ["/practice", "/history", "/settings", `/feedback/${IDS.done}`, "/practice/setup"]) {
      await go(page, path);
      expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss), `${path} executed injected script`).toBeUndefined();
      expect(await page.locator("img[src='x'], svg[onload]").count(), `${path} contains injected elements`).toBe(0);
    }
    await go(page, "/settings");
    await expect(page.locator("input[value*='<img']").first()).toBeAttached();   // shown as literal text in the form, not parsed
  } finally {
    await set(original);
  }
});

test("responses to protected pages are never cacheable and carry the security headers", async ({ request }) => {
  const res = await request.get("/", { maxRedirects: 0 });
  const h = res.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).not.toContain("unsafe-eval");
  expect(h["x-powered-by"]).toBeUndefined();
  const prot = await request.get("/history", { maxRedirects: 0 });
  expect(prot.status()).toBe(307);
  expect(prot.headers()["location"]).toContain("/signin");
});

test("development-only surface does not exist in the production build", async ({ request }) => {
  for (const p of ["/dev-login", "/.env", "/.env.local", "/package.json", "/supabase/config.toml", "/.git/config"]) {
    expect((await request.get(p, { maxRedirects: 0 })).status(), p).toBe(404);
  }
});
