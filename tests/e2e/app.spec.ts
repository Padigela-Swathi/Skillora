import { expect, test } from "@playwright/test";
import { IDS, login, noConsoleErrors, alertOf, go, userJwt } from "./helpers";

const shot = (page: import("@playwright/test").Page, project: string, name: string) => page.screenshot({ path: `e2e-shots/${project}-${name}.png`, fullPage: true });
const noHScroll = async (page: import("@playwright/test").Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
// rating-due fixtures: the 1st (…0010) and 6th (…0015) completed interviews
const RATING_ID = (project: string) => (project === "mobile" ? "aaaaaaaa-0000-4000-8000-000000000015" : "aaaaaaaa-0000-4000-8000-000000000010");

test.beforeEach(async ({ context, baseURL }) => { await login(context, "b", baseURL!); });

test("practice -> device check -> tips (real selection flows through the URL)", async ({ page, context }, info) => {
  const p = info.project.name;
  const errors = noConsoleErrors(page);
  await go(page, "/practice");
  await expect(page.getByRole("heading", { name: "Hi Bhavya, ready to practise?" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "interviews left today" })).toContainText(/\d of 3/);
  await expect(page.getByRole("link", { name: "Resume interview" })).toBeVisible();   // B has live interviews in progress
  await shot(page, p, "06-practice");
  await page.getByRole("radio", { name: /Technical Round/ }).click();
  await page.getByRole("radio", { name: "Hard" }).click();
  await page.getByRole("radio", { name: /15 min/ }).click();
  await expect(page.getByText("Technical Round · Hard · 15 min · about 9 questions")).toBeVisible();
  await expect(page.getByText("Deeper follow ups and trickier questions")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/practice\/setup\?round=tech&level=Hard&dur=15/);

  // camera + mic: Continue is disabled until permission is granted
  await expect(page.getByRole("heading", { name: "Check your camera and mic" })).toBeVisible();
  const cont = page.getByRole("button", { name: "Continue" });
  await expect(cont).toBeDisabled();
  await shot(page, p, "07-device-check-before");
  await context.grantPermissions(["camera", "microphone"]);
  await page.getByRole("button", { name: "Allow camera and microphone" }).click();
  await expect(page.getByText("Self view")).toBeVisible();
  await expect(cont).toBeEnabled();
  await expect(cont).toHaveCSS("background-color", "rgb(51, 92, 103)");   // transition finished (deep teal)
  await expect(page.getByLabel("Camera", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Microphone", { exact: true })).toBeEnabled();
  await shot(page, p, "07-device-check-allowed");
  await cont.click();
  await expect(page).toHaveURL(/\/practice\/tips\?round=tech&level=Hard&dur=15/);

  await expect(page.getByText("Technical Round · Hard · 15 min")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before you begin" })).toBeVisible();
  await expect(page.getByText("Zoho")).toBeVisible();
  await expect(page.getByText("Think out loud, interviewers value your reasoning")).toBeVisible();
  await shot(page, p, "08-tips");
  await noHScroll(page);
  expect(errors).toEqual([]);
});

test("invalid selection params bounce back to practice", async ({ page }) => {
  await go(page, "/practice/tips?round=nope&level=Easy&dur=10");
  await expect(page).toHaveURL(/\/practice$/);
  await go(page, "/practice/setup?round=hr&level=Easy&dur=99");
  await expect(page).toHaveURL(/\/practice$/);
});

test("start interview: real Edge Function call, friendly error or room (depends on AI secret)", async ({ page }) => {
  await go(page, "/practice/tips?round=hr&level=Easy&dur=5");
  await page.getByRole("button", { name: "I am ready, start interview" }).click();
  await expect(page.getByText("Preparing your interview…")).toBeVisible();
  const outcome = await Promise.race([
    page.waitForURL(/\/interview\/[0-9a-f-]{36}$/, { timeout: 100_000 }).then(() => "room"),
    alertOf(page).waitFor({ timeout: 100_000 }).then(() => "error"),
  ]);
  if (outcome === "error") {
    await expect(alertOf(page)).toContainText(/AI interviewer is not available yet|busy|unusable|daily|3 interviews/i);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  }
  test.info().annotations.push({ type: "result", description: `start-interview -> ${outcome}` });
});

test("feedback report: score ring, sub-scores, per-question cards, skipped line", async ({ page }, info) => {
  const p = info.project.name;
  await go(page, `/feedback/${IDS.done}`);
  await expect(page.getByRole("heading", { name: "Your feedback", level: 1 })).toBeVisible();
  await expect(page.getByText("Technical Round · Easy · 10 min · 3 answered, 1 skipped")).toBeVisible();
  await expect(page.getByRole("img", { name: "Score 78 out of 100, Interview ready" })).toBeVisible();
  await expect(page.getByText("Interview ready", { exact: true }).first()).toBeVisible();
  for (const s of ["Technical accuracy", "Depth", "Communication", "Clarity"]) await expect(page.getByText(s, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Strengths" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Weaknesses to work on" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tips for next time" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What is the difference between a process and a thread?" })).toBeVisible();
  await expect(page.getByText("1 question was skipped")).toBeVisible();
  await expect(page.getByText("Skipped · not scored")).toBeVisible();
  await expect(page.getByText("68 · Getting there")).toBeVisible();
  await expect(page.getByRole("link", { name: "Retry this round" })).toHaveAttribute("href", "/practice/setup?round=tech&level=Easy&dur=10");
  await expect(page.getByText("How useful was this feedback?")).toHaveCount(0);   // 3rd+ completed interview: not due
  await shot(page, p, "13-feedback");
  await noHScroll(page);
});

test("feedback: ended-early pill and not-found for foreign/invalid ids", async ({ page }, info) => {
  await go(page, `/feedback/${IDS.doneEnded}`);
  await expect(page.getByText("Ended early")).toBeVisible();
  await expect(page.getByText("Coding Round · Medium · 15 min · 2 answered", { exact: false })).toBeVisible();
  await shot(page, info.project.name, "11-feedback-ended-early");
  const res = await go(page, "/feedback/aaaaaaaa-0000-4000-8000-0000000fffff");
  expect(res?.status()).toBe(404);
});

test("feedback rating: shown after the 1st/6th interview, stored once, then hidden", async ({ page, request, baseURL }, info) => {
  const id = RATING_ID(info.project.name);
  await go(page, `/feedback/${id}`);
  const card = page.getByText("How useful was this feedback?");
  if (!(await card.isVisible())) {
    // Already rated in an earlier run against this database: prove the rating is really persisted, and that the card stays hidden.
    const jwt = await userJwt("b", baseURL!);
    const r = await request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/feedback_ratings?interview_id=eq.${id}&select=stars,comment`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${jwt}` } });
    expect((await r.json()).length).toBe(1);
    info.annotations.push({ type: "note", description: "rating already stored by a previous run; verified persisted via API" });
    return;
  }
  await shot(page, info.project.name, "13-feedback-rating");
  await page.getByRole("button", { name: "Send rating" }).click();
  await expect(alertOf(page)).toContainText("Choose 1 to 5 stars");
  await page.getByRole("radio", { name: "4 stars" }).click();
  await expect(page.getByRole("radio", { name: "4 stars" })).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("Comment").fill("Helpful, thank you");
  await page.getByRole("button", { name: "Send rating" }).click();
  await expect(page.getByText("Thanks for rating this feedback.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("How useful was this feedback?")).toHaveCount(0);
});

test("history: overall performance, trend, filters, rows open the report", async ({ page }, info) => {
  const p = info.project.name;
  await go(page, "/history");
  await expect(page.getByRole("heading", { name: "History", level: 1 })).toBeVisible();
  await expect(page.getByText(/across \d+ interviews/)).toBeVisible();   // count grows when the live-AI interview spec completes real interviews
  await expect(page.getByRole("img", { name: /Score trend/ })).toBeVisible();
  await expect(page.getByText(/(Up|Down) \d+ points since your first interview/)).toBeVisible();
  await shot(page, p, "14-history");
  await page.getByRole("radio", { name: "Coding" }).click();
  await expect(page.getByRole("link", { name: /Coding Round/ })).toHaveCount(2);
  await expect(page.getByRole("link", { name: /HR Round/ })).toHaveCount(0);
  await shot(page, p, "14-history-filter-coding");
  await page.getByRole("radio", { name: "All" }).click();
  await page.getByRole("link", { name: /Technical Round.*78 · Interview ready/ }).click();
  await expect(page).toHaveURL(new RegExp(`/feedback/${IDS.done}`));
  await noHScroll(page);
});

test("settings: edit profile with validation, save persists, sign out", async ({ page }, info) => {
  const p = info.project.name;
  await go(page, "/settings");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await expect(page.getByLabel(/Full name/)).toHaveValue("Bhavya Rao");
  await expect(page.getByText("e2e-b@skillora-test.invalid")).toBeVisible();
  await page.getByLabel(/Full name/).fill("");
  await page.getByLabel(/Age/).fill("7");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await expect(page.getByText("Enter an age between 15 and 60")).toBeVisible();
  await expect(page.getByText("Saved")).toHaveCount(0);
  await page.getByLabel(/Full name/).fill("Bhavya Rao");
  await page.getByLabel(/Age/).fill("20");
  await page.getByRole("radio", { name: "IT" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await shot(page, p, "15-settings-saved");
  await page.reload();
  await expect(page.getByLabel(/College/)).toHaveValue("CBIT");
  await expect(page.getByRole("radio", { name: "IT" })).toHaveAttribute("aria-checked", "true");
  // delete dialog opens and cancels (the real deletion is exercised in onboarding.spec with a throwaway user)
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("dialog", { name: "Delete your account?" })).toBeVisible();
  await shot(page, p, "15-settings-delete-dialog");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await go(page, "/practice");
  await expect(page).toHaveURL(/\/signin$/);
});

test("navigation: header pills (desktop) / bottom tab bar (mobile)", async ({ page }, info) => {
  await go(page, "/practice");
  const nav = page.getByRole("navigation", { name: "Main" });
  const visible = nav.filter({ visible: true });
  await expect(visible).toHaveCount(1);
  await visible.getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(visible.getByRole("link", { name: "History" })).toHaveAttribute("aria-current", "page");
  await visible.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  void info;
});
