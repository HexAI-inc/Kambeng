import { expect, test } from "@playwright/test";

const adminUsername = process.env.E2E_ADMIN_USERNAME;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("public routes", () => {
  test("home and campaigns pages load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Kambeng Crowdfunding")).toBeVisible();

    await page.goto("/campaigns");
    await expect(page.getByText("Campaign Discovery")).toBeVisible();
  });
});

test.describe("auth redirects", () => {
  test("dashboard redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("admin redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("authenticated admin routes", () => {
  test.skip(!adminUsername || !adminPassword, "Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to run authenticated smoke tests");

  test("login and visit admin pages", async ({ page }) => {
    await page.goto("/auth/login");

    await page.locator("#login-username").fill(adminUsername!);
    await page.locator("#login-password").fill(adminPassword!);
    await page.locator("form button[type='submit']").click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/admin/campaigns");
    await expect(page.getByText("Admin Campaigns")).toBeVisible();

    await page.goto("/admin/users");
    await expect(page.getByText("Admin Users")).toBeVisible();

    await page.goto("/admin/moderation");
    await expect(page.getByText("Moderation Queue")).toBeVisible();
  });

  test("expired access token is refreshed and original request is retried", async ({ page, context }) => {
    await page.goto("/auth/login");

    await page.locator("#login-username").fill(adminUsername!);
    await page.locator("#login-password").fill(adminPassword!);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    const existingCookies = await context.cookies();
    const accessCookie = existingCookies.find((cookie) => cookie.name === "kambeng_access_token");
    const refreshCookie = existingCookies.find((cookie) => cookie.name === "kambeng_refresh_token");
    expect(accessCookie).toBeTruthy();
    expect(refreshCookie).toBeTruthy();

    // Replace auth cookies deterministically: invalid access token + valid refresh token.
    await context.clearCookies();
    const appOrigin = new URL(page.url()).origin;
    await context.addCookies([
      {
        name: "kambeng_access_token",
        value: "expired-access-token-for-refresh-test",
        url: appOrigin,
      },
      {
        name: refreshCookie!.name,
        value: refreshCookie!.value,
        url: appOrigin,
      },
    ]);

    const injectedCookies = await context.cookies();
    expect(injectedCookies.some((cookie) => cookie.name === "kambeng_access_token")).toBeTruthy();
    expect(injectedCookies.some((cookie) => cookie.name === "kambeng_refresh_token")).toBeTruthy();

    const refreshResponses: number[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/api/auth/refresh") && response.request().method() === "POST") {
        refreshResponses.push(response.status());
      }
    });

    await page.goto("/admin/campaigns");
    await expect.poll(() => refreshResponses.length, { timeout: 10000 }).toBeGreaterThan(0);
    expect(refreshResponses).toContain(200);
    await expect(page).toHaveURL(/\/admin\/campaigns/);
    await expect(page.getByText("Admin Campaigns")).toBeVisible();
  });
});
