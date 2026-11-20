import { expect, test } from "@playwright/test";
import { login, USERS, sessionCookies, go } from "./helpers";

// User C is a brand-new account: no terms accepted, empty profile. The test also deletes it at the end (real delete-account call).
test("new user: terms gate -> decline signs out -> accept -> details validation -> practice -> delete account", async ({ page, context, baseURL }, info) => {
  const p = info.project.name;
  test.skip(p === "mobile", "single destructive journey: runs once, on the desktop project");
  const C = { email: "e2e-c@skillora-test.invalid", password: USERS.a.password };
  await login(context, "a", baseURL!);   // placeholder to prove helper; cleared next
  await context.clearCookies();
  await context.addCookies(await sessionCookies(C, baseURL!));

  // gate: signed in but terms not accepted => terms page, everywhere
  await go(page, "/practice");
  await expect(page).toHaveURL(/\/onboarding\/terms$/);
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  await expect(page.getByText("Step 1 of 2")).toBeVisible();
  const accept = page.getByRole("button", { name: "Accept and continue" });
  await expect(accept).toBeDisabled();
  await page.screenshot({ path: `test-results/shots/${p}-03-terms.png`, fullPage: true });
  await page.getByRole("tab", { name: "Privacy Policy" }).click();
  await expect(page.getByText("We do not record or store any video.")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Privacy Policy" })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: `test-results/shots/${p}-03b-terms-privacy.png`, fullPage: true });
  await page.getByRole("tab", { name: "Terms and Conditions" }).click();
  await page.getByRole("checkbox", { name: /I have read and accept/ }).check();
  await expect(accept).toBeEnabled();
  await page.screenshot({ path: `test-results/shots/${p}-03-terms-checked.png`, fullPage: true });

  // decline => signed out (session really gone)
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page).toHaveURL(/\/signed-out$/);
  await go(page, "/practice");
  await expect(page).toHaveURL(/\/signin$/);

  // sign in again, accept for real (RPC), land on details
  await context.addCookies(await sessionCookies(C, baseURL!));
  await go(page, "/onboarding/terms");
  await page.getByRole("checkbox", { name: /I have read and accept/ }).check();
  await page.getByRole("button", { name: "Accept and continue" }).click();
  await expect(page).toHaveURL(/\/onboarding\/details$/);
  await expect(page.getByText("Step 2 of 2")).toBeVisible();
  await expect(page.getByLabel(/Full name/)).toHaveValue("Chaitanya Varma");   // prefilled from the Google profile name
  await expect(page.getByText("e2e-c@skillora-test.invalid · from Google")).toBeVisible();

  // validation (name ok, college/branch/year missing, bad age)
  await page.getByLabel(/Age/).fill("99");
  await page.getByRole("button", { name: "Continue to practice" }).click();
  await expect(page.getByText("Enter your college name.")).toBeVisible();
  await expect(page.getByText("Choose your branch.")).toBeVisible();
  await expect(page.getByText("Choose your year of study.")).toBeVisible();
  await expect(page.getByText("Enter an age between 15 and 60")).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${p}-05-details-errors.png`, fullPage: true });
  await page.getByLabel(/College/).fill("JNTU Hyderabad");
  await page.getByRole("radio", { name: "CSE" }).click();
  await page.getByRole("radio", { name: "3rd year" }).click();
  await page.getByLabel(/Age/).fill("");
  await page.getByLabel(/Gender/).selectOption("Prefer not to say");
  await page.getByRole("button", { name: "Continue to practice" }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole("heading", { name: "Hi Chaitanya, ready to practise?" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "interviews left today" })).toContainText("3 of 3");
  await expect(page.getByText("Last interview")).toHaveCount(0);   // no history yet

  // history empty state
  await go(page, "/history");
  await expect(page.getByRole("heading", { name: "No interviews yet" })).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${p}-14-history-empty.png`, fullPage: true });

  // delete account for real
  await go(page, "/settings");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await context.clearCookies();
  await expect(sessionCookies(C, baseURL!)).rejects.toThrow(/sign-in failed/);   // the account no longer exists
});
