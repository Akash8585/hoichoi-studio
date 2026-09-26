import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("editor@hoichoi.demo");
  await page.getByLabel("Password").fill("HoichoiDemo2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: /Campaigns move from one brief/i })
  ).toBeVisible({ timeout: 20_000 });
}

test("desktop Framer campaign workspace", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByText("Active campaigns")).toBeVisible();
  await page.screenshot({
    path: "test-results/visual/campaigns-desktop.png",
    fullPage: true,
  });

  await page.goto("/studio");
  await expect(page.getByRole("link", { name: "Images" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Videos" }).first()).toBeVisible();
  await expect(page.getByLabel("Title or campaign name")).toBeVisible();
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  await page.screenshot({
    path: "test-results/visual/create-desktop.png",
    fullPage: true,
  });
});

test("mobile navigation and aligned brief form", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  await page.getByRole("link", { name: "Create" }).click();
  await expect(page.getByLabel("Title or campaign name")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
  await page.screenshot({
    path: "test-results/visual/create-mobile.png",
    fullPage: true,
  });
});

test("videos roadmap and integrations honesty labels", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);

  await page.goto("/studio/videos");
  await expect(
    page.getByRole("heading", { name: /AI Video Studio is in development/i })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Generate video/i })).toBeDisabled();
  await expect(page.getByText(/intentionally disabled/i)).toBeVisible();

  await page.goto("/integrations");
  await expect(page.getByRole("heading", { name: "Connected accounts" })).toBeVisible();
  await expect(page.getByText("Instagram")).toBeVisible();
  await expect(page.getByText("YouTube")).toBeVisible();
  await expect(page.getByText("Connected").first()).toBeVisible();
});

