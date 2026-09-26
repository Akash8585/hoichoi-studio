import { test, expect } from "@playwright/test";

test("login and open command center", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("editor@hoichoi.demo");
  await page.getByLabel("Password").fill("HoichoiDemo2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", {
      name: /Campaigns move from one brief/i,
    })
  ).toBeVisible({ timeout: 15000 });
});

test("health endpoint is public", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.ok).toBe(true);
});
