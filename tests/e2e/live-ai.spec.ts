import { expect, test } from "@playwright/test";
import { go, login, scanA11y } from "./helpers";

// Renders a REAL AI-generated report. Create one first (start-interview → answer → finish → evaluate-interview),
// then run:  E2E_LIVE_INTERVIEW_ID=<id> npx playwright test live-ai.spec.ts
const ID = process.env.E2E_LIVE_INTERVIEW_ID;

test("a real AI-written feedback report renders completely", async ({ page, context, baseURL }, info) => {
  test.skip(!ID, "set E2E_LIVE_INTERVIEW_ID to the id of a completed, AI-evaluated interview");
  await login(context, "b", baseURL!);
  await go(page, `/feedback/${ID}`);
  await expect(page.getByRole("heading", { name: "Your feedback", level: 1 })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Score \d+ out of 100/ })).toBeVisible();
  for (const h of ["Strengths", "Weaknesses to work on", "Tips for next time", "Question by question"]) await expect(page.getByRole("heading", { name: h })).toBeVisible();
  const cards = page.locator("article");
  expect(await cards.count()).toBeGreaterThan(0);
  for (const label of ["What went well", "To improve", "A stronger answer"]) expect(await page.getByText(label, { exact: true }).count()).toBeGreaterThanOrEqual(await cards.count());
  await page.screenshot({ path: `e2e-shots/${info.project.name}-13-feedback-LIVE-AI.png`, fullPage: true });
  await scanA11y(page, "live AI feedback");
});
