import { expect, test, type Page } from "@playwright/test";
import { go, login } from "./helpers";

// Regression for "Maximum update depth exceeded" in the interview room, which only showed up on a DEV server (`npm run dev`).
// Run against a dev server:  E2E_DEV=1 E2E_PORT=3200 npx playwright test room-dev.spec.ts   (fixture …0601 = copy of a real AI Technical interview)
const ROOM = "aaaaaaaa-0000-4000-8000-000000000601";
test.skip(!process.env.E2E_DEV, "dev-server-only regression test (set E2E_DEV=1 and E2E_PORT to a running `next dev`)");

function watch(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
  return errors;
}

test("room loads and ticks on a dev server (typed-fallback browser)", async ({ page, context, baseURL }) => {
  const errors = watch(page);
  await login(context, "b", baseURL!);
  await go(page, `/interview/${ROOM}`);
  await expect(page.getByText("Question 1 of 3")).toBeVisible();
  const first = await page.getByText(/\d\d:\d\d left/).innerText();
  await page.waitForTimeout(2500);
  expect(await page.getByText(/\d\d:\d\d left/).innerText()).not.toBe(first);   // the clock really ticks
  expect(errors).toEqual([]);
});

test("room loads on a dev server when speech recognition and voice WORK (what real Chrome does)", async ({ page, context, baseURL }) => {
  await page.addInitScript(() => {
    class FakeSR {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null;
      timer: ReturnType<typeof setTimeout> | null = null;
      start() { this.timer = setTimeout(() => this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, length: 1, 0: { transcript: "a primary key identifies a row" } } } }), 300); }
      stop() { if (this.timer) clearTimeout(this.timer); setTimeout(() => this.onend?.(), 10); }
      abort() { this.stop(); }
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeSR;
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeSR;   // modern Chrome exposes the unprefixed name, which the app prefers
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { getVoices: () => [], speak(u: { onend?: () => void }) { setTimeout(() => u.onend?.(), 300); }, cancel() {} } });
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = function (this: Record<string, unknown>, t: string) { this.text = t; };
  });
  const errors = watch(page);
  await login(context, "b", baseURL!);
  await go(page, `/interview/${ROOM}`);
  await expect(page.getByText("Question 1 of 3")).toBeVisible();
  await expect(page.getByText("a primary key identifies a row")).toBeVisible();   // live transcript from the (fake) recogniser
  await page.getByRole("button", { name: /^Done/ }).click();
  await expect(page.getByText("Question 2 of 3")).toBeVisible();
  expect(errors).toEqual([]);
});

test("FULL flow on a dev server: practice -> continue -> camera check -> tips -> start (real AI) -> room", async ({ page, context, baseURL }) => {
  test.setTimeout(240_000);
  const errors = watch(page);
  await login(context, "b", baseURL!);
  await go(page, "/practice");
  await page.getByRole("radio", { name: /HR Round/ }).click();
  await page.getByRole("radio", { name: "Easy" }).click();
  await page.getByRole("radio", { name: /^5 min/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/practice\/setup\?round=hr&level=Easy&dur=5/);
  await page.getByRole("button", { name: "Allow camera and microphone" }).click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/practice\/tips\?/);
  await page.getByRole("button", { name: "I am ready, start interview" }).click();
  await page.waitForURL(/\/interview\/[0-9a-f-]{36}$/, { timeout: 150_000 });
  await expect(page.getByText("Question 1 of 3")).toBeVisible();
  await expect(page.getByText(/\d\d:\d\d left/)).toBeVisible();
  expect(errors).toEqual([]);
});
