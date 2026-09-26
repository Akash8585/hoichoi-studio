import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("full content studio smoke with live APIs", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/login");
  await page.getByLabel("Email").fill("editor@hoichoi.demo");
  await page.getByLabel("Password").fill("HoichoiDemo2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Campaigns move from one brief/i })).toBeVisible({ timeout: 20000 });

  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: /Turn one brief into three native/i })).toBeVisible();

  // Create a fresh brief and generate (uses OpenRouter + Pollinations)
  const stamp = Date.now().toString().slice(-6);
  await page.getByPlaceholder(/কাদম্বিনী|নতুন পর্ব/i).fill(`টেস্ট প্রমো ${stamp}`);
  await page
    .locator("textarea")
    .first()
    .fill(
      "একটি নতুন বাংলা নাটকের প্রচার। টার্গেট ২৫-৪০। টোন সিনেম্যাটিক, স্পয়লার-মুক্ত। Include native English too."
    );
  await page.getByPlaceholder(/Describe the story/i).fill(
    "একটি নতুন বাংলা নাটকের প্রচার। টার্গেট ২৫-৪০। টোন সিনেম্যাটিক, স্পয়লার-মুক্ত। Include native English too."
  );
  await page.getByRole("button", { name: /Generate campaign/i }).click();

  await expect(page.getByText(/instagram reels/i).first()).toBeVisible({
    timeout: 150000,
  });
  await expect(page.getByText(/youtube shorts/i).first()).toBeVisible();
  await expect(page.getByText(/^x$/i).or(page.getByText(/channel/i)).first()).toBeVisible();

  // Submit first package if Submit buttons exist
  const submit = page.getByRole("button", { name: /Submit for review/i }).first();
  if (await submit.isVisible()) {
    await submit.click();
  }

  await page.goto("/approvals");
  await expect(page.getByRole("heading", { name: /Review every word/i })).toBeVisible();
  const approve = page.getByRole("button", { name: /Approve package/i }).first();
  if (await approve.isVisible({ timeout: 5000 }).catch(() => false)) {
    await approve.click();
  }

  await page.goto("/publisher");
  await expect(page.getByRole("heading", { name: /Schedule confidently/i })).toBeVisible();

  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: /Turn measured outcomes/i })).toBeVisible();
  await page.getByRole("button", { name: /Generate weekly report/i }).click();
  await expect(page.getByText(/Evidence-backed weekly report|No published posts/i).first()).toBeVisible({
    timeout: 90000,
  });
});

test("health ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
});
