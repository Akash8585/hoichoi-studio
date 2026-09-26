import { test, expect } from "@playwright/test";

test("judge flow: approval, publish, comparison, cited report, next brief", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("editor@hoichoi.demo");
  await page.getByLabel("Password").fill("HoichoiDemo2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Campaigns move from one brief/i })).toBeVisible();

  await page.goto("/approvals");
  await expect(page.getByRole("heading", { name: /Review every word/i })).toBeVisible();
  await page.waitForTimeout(1800);
  for (let index = 0; index < 3; index += 1) {
    const cards = page.locator("article").filter({ hasText: "কাদম্বিনী" });
    const before = await cards.count();
    const approve = cards.getByRole("button", { name: /Approve package/i }).first();
    if (!(await approve.isVisible().catch(() => false))) break;
    await approve.click();
    await expect(
      page.getByRole("status").filter({ hasText: /approved/i }).first()
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(cards).toHaveCount(before - 1, { timeout: 10_000 });
  }

  await page.goto("/publisher");
  await expect(page.getByRole("heading", { name: /Schedule confidently/i })).toBeVisible();
  await page.waitForTimeout(1800);
  for (let index = 0; index < 3; index += 1) {
    const cards = page.locator("article").filter({ hasText: "কাদম্বিনী" });
    const publishButtons = cards.getByRole("button", { name: "Publish now" });
    const before = await publishButtons.count();
    const publish = publishButtons.first();
    if (!(await publish.isVisible().catch(() => false))) break;
    await publish.click();
    await expect(page.getByText(/Post published|Live/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(publishButtons).toHaveCount(before - 1, { timeout: 10_000 });
  }

  await page.goto("/insights");
  await expect(page.getByRole("button", { name: "Image analytics" })).toBeVisible();
  await expect(page.getByText(/Simulated metrics/i).first()).toBeVisible();
  const select = page.getByLabel("Campaign to compare");
  await expect(select.locator("option").first()).toBeAttached({ timeout: 20_000 });
  const demoValue = await select.locator("option").evaluateAll((options) => {
    const match = options.find((option) =>
      option.textContent?.includes("কাদম্বিনী")
    ) as HTMLOptionElement | undefined;
    return match?.value || "";
  });
  expect(demoValue).toBeTruthy();
  await select.selectOption(demoValue);
  await expect(page.getByText(/Winning channel/i)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: /Generate weekly report/i }).click();
  await expect(page.getByText(/Weekly insight created/i)).toBeVisible({ timeout: 60_000 });
  const report = page.locator("article").first();
  await expect(report.getByText(/Instagram Reels|YouTube Shorts|^X$/).first()).toBeVisible();
  await report.getByRole("button", { name: "Use in next brief" }).click();
  await expect(page).toHaveURL(/\/studio\?brief=/);
});

