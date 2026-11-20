import { expect, test } from "@playwright/test";
import { go, IDS, login, scanA11y as scan } from "./helpers";

test("a11y: public pages", async ({ page }) => {
  for (const path of ["/", "/signin", "/legal/terms", "/legal/privacy", "/signed-out"]) { await go(page, path); await scan(page, path); }
});

test("a11y: signed-in screens", async ({ page, context, baseURL }) => {
  await login(context, "b", baseURL!);
  for (const path of ["/practice", "/practice/setup?round=tech&level=Easy&dur=10", "/practice/tips?round=tech&level=Easy&dur=10", `/feedback/${IDS.done}`, "/history", "/settings"]) {
    await go(page, path); await scan(page, path);
  }
});

test("a11y: interview room (spoken question and coding question)", async ({ page, context, baseURL }, info) => {
  await login(context, "b", baseURL!);
  const live = info.project.name === "mobile" ? "aaaaaaaa-0000-4000-8000-000000000101" : IDS.live;
  await go(page, `/interview/${live}`);
  await expect(page.getByText("Question 1 of 3")).toBeVisible();
  await scan(page, "interview (spoken)");
});

test("a11y: dialogs and keyboard operation", async ({ page, context, baseURL }) => {
  await login(context, "b", baseURL!);
  await go(page, "/settings");
  await page.getByRole("button", { name: "Delete my account" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete your account?" });
  await expect(dialog).toBeVisible();
  await scan(page, "delete dialog");
  // focus is trapped inside the dialog and returns to the trigger on Escape
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete my account" })).toBeFocused();
  // segmented control is operable with arrow keys
  await page.getByRole("radio", { name: "CSE" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "IT" })).toHaveAttribute("aria-checked", "true");
});
